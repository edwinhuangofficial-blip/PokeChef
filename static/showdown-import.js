// Free import parsing is local, so it also works from a static development server.
// Keep validation aligned with showdown_parser.py; the server revalidates AI requests.
(function (root) {
    function parseStats(text) {
        const result = {};
        for (const part of text.split('/')) {
            const match = part.match(/^\s*(\d+)\s+(HP|Atk|Def|SpA|SpD|Spe)\s*$/i);
            if (!match) throw new Error(`Invalid stat entry: ${part}`);
            const stat = match[2].toLowerCase();
            if (stat in result) throw new Error(`Duplicate stat: ${match[2]}`);
            result[stat] = Number(match[1]);
        }
        return result;
    }
    function parseSet(block) {
        const lines = block.split('\n').map(line => line.trim()).filter(Boolean);
        const header = lines.shift();
        if (!header || header.startsWith('-') || header.includes(':')) throw new Error('Expected a Pokémon name on the first line.');
        const split = header.indexOf(' @ ');
        let name = split < 0 ? header : header.slice(0, split);
        const item = split < 0 ? null : header.slice(split + 3);
        let gender = null;
        if (/ \([MF]\)$/.test(name)) { gender = name.at(-2); name = name.slice(0, -4).trim(); }
        const nick = name.match(/^(.+?)\s+\(([^()]+)\)$/);
        const species = nick ? nick[2] : name;
        if (!species.trim() || item === '') throw new Error('Pokémon name or held item is empty.');
        const pokemon = {species, nickname: nick ? nick[1] : null, gender, item, ability: null, level: 100, tera_type: null, nature: null, evs: {}, ivs: {}, moves: []};
        const warnings = [];
        const seen = new Set(gender ? ['Gender'] : []);
        for (const line of lines) {
            const colon = line.indexOf(':');
            const field = colon >= 0 ? line.slice(0, colon) : line.endsWith(' Nature') ? 'Nature' : null;
            if (['Ability', 'Gender', 'Level', 'Tera Type', 'EVs', 'IVs', 'Nature'].includes(field)) {
                if (seen.has(field)) throw new Error(`${species}: duplicate ${field} field.`);
                seen.add(field);
                if (colon >= 0 && !line.slice(colon + 1).trim()) throw new Error(`${species}: ${field} is empty.`);
            }
            if (line.startsWith('Ability: ')) pokemon.ability = line.slice(9);
            else if (line.startsWith('Gender: ')) {
                const value = line.slice(8).trim();
                if (!['M', 'F', 'N'].includes(value)) throw new Error(`${species}: gender must be M, F, or N.`);
                pokemon.gender = value;
            }
            else if (line.startsWith('Level: ')) {
                const value = line.slice(7);
                if (!/^[+-]?\d+$/.test(value)) throw new Error(`${species}: level must be a whole number.`);
                pokemon.level = Number(value);
            } else if (line.startsWith('Tera Type: ')) pokemon.tera_type = line.slice(11);
            else if (line.startsWith('EVs: ')) pokemon.evs = parseStats(line.slice(5));
            else if (line.startsWith('IVs: ')) pokemon.ivs = parseStats(line.slice(5));
            else if (line.endsWith(' Nature')) pokemon.nature = line.slice(0, -7);
            else if (line.startsWith('- ')) pokemon.moves.push(line.slice(2));
            else warnings.push(`${species}: unrecognized line was not imported: ${line}`);
        }
        if (pokemon.level < 1 || pokemon.level > 100) throw new Error(`${species}: level must be between 1 and 100.`);
        if (Object.values(pokemon.evs).some(v => v > 252) || Object.values(pokemon.evs).reduce((a, b) => a + b, 0) > 510) throw new Error(`${species}: EVs must be 0–252 per stat and total at most 510.`);
        if (Object.values(pokemon.ivs).some(v => v > 31)) throw new Error(`${species}: IVs must be between 0 and 31.`);
        if (pokemon.moves.length > 4 || new Set(pokemon.moves).size !== pokemon.moves.length) throw new Error(`${species}: provide at most four different moves.`);
        for (const [key, label] of [['ability', 'ability'], ['nature', 'nature'], ['evs', 'EV spread'], ['moves', 'moves']]) {
            const value = pokemon[key];
            if (!value || typeof value === 'object' && !Object.keys(value).length) warnings.push(`${species}: no ${label} specified.`);
        }
        if (!item) warnings.push(`${species}: no held item specified; this may be intentional.`);
        return {pokemon, warnings};
    }
    function parse(text) {
        try {
            if (text.length > 12000) throw new Error('Team imports must be at most 12,000 characters.');
            text = text.replace(/\r\n?/g, '\n').trim();
            if (text.startsWith('===')) text = text.split('\n').slice(1).join('\n').trim();
            if (!text) throw new Error('Paste a Pokémon Showdown team first.');
            if (text.split('\n').some(line => line.trim().startsWith('==='))) throw new Error('Import one team at a time, rather than a full team backup.');
            const blocks = text.split(/\n\s*\n/);
            if (blocks.length > 6) throw new Error('A team can contain at most six Pokémon.');
            const sets = blocks.map(parseSet);
            return {count: sets.length, team: sets.map(set => set.pokemon), warnings: sets.flatMap(set => set.warnings), note: 'Import preview only. Names, set legality, and format rules have not been verified.'};
        } catch (error) { return {error: error.message}; }
    }
    if (typeof module !== 'undefined' && module.exports) module.exports = {parse};
    else root.ShowdownImport = {parse};
})(globalThis);
