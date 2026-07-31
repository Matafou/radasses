/**
 * Génère `supabase/tests/split_generated.test.sql` (pgTAP) à partir des cas
 * canoniques de `src/lib/split.cases.ts`. Ainsi la fonction SQL `compute_split`
 * et la fonction TS `previewSplit` sont vérifiées sur EXACTEMENT les mêmes
 * entrées/sorties → aucune dérive silencieuse possible.
 *
 *   npm run gen:split-sql        (puis: supabase test db)
 *
 * NE PAS éditer le .sql généré à la main : modifier `split.cases.ts` et
 * relancer la génération.
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
// .ts explicite : exécuté par Node (type-stripping natif), qui exige l'extension.
import { splitCases } from '../src/lib/split.cases.ts';

const OUT = fileURLToPath(new URL('../supabase/tests/split_generated.test.sql', import.meta.url));

const jsonbLiteral = (obj: unknown) => `'${JSON.stringify(obj).replace(/'/g, "''")}'::jsonb`;
const textLiteral = (s: string) => `'${s.replace(/'/g, "''")}'`;

const lines: string[] = [
	'-- FICHIER GÉNÉRÉ — ne pas éditer à la main.',
	'-- Source : src/lib/split.cases.ts · Régénérer : npm run gen:split-sql',
	'-- Vérifie que compute_split (SQL) donne les mêmes résultats que previewSplit (TS).',
	'',
	'begin;',
	'create extension if not exists pgtap;',
	`select plan(${splitCases.length});`,
	''
];

for (const c of splitCases) {
	lines.push(`-- ${c.name}`);
	if ('error' in c.expected) {
		// throws_ok(sql, errcode, errmsg, description) : errmsg=NULL -> on ne
		// teste QUE le SQLSTATE (le libellé exact n'est pas figé côté cas).
		lines.push('select throws_ok(');
		lines.push(`  $$ select compute_split(${c.totalCents}, ${jsonbLiteral(c.benefs)}) $$,`);
		lines.push(`  'P0001', NULL, ${textLiteral(c.name)}`);
		lines.push(');');
	} else {
		lines.push('select is(');
		lines.push(
			`  (select jsonb_object_agg(v->>'person_id', (v->>'amount_cents')::int)` +
				`\n   from jsonb_array_elements(compute_split(${c.totalCents}, ${jsonbLiteral(c.benefs)})) v),`
		);
		lines.push(`  ${jsonbLiteral(c.expected.amounts)},`);
		lines.push(`  ${textLiteral(c.name)}`);
		lines.push(');');
	}
	lines.push('');
}

lines.push('select * from finish();');
lines.push('rollback;');
lines.push('');

writeFileSync(OUT, lines.join('\n'));
console.log(`Écrit ${OUT} (${splitCases.length} cas).`);
