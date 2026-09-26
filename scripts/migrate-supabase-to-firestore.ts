// Reprise des données Supabase (Postgres) → Firestore, au format de l'adaptateur
// `src/lib/backend/firebase/` (voir `model.ts` et `firestore.rules`).
//
// Conserve les ids ET les jetons (les liens déjà partagés continuent de fonctionner),
// renumérote le journal par séjour (1..n dans l'ordre des anciens `id`). Les uid
// anonymes Supabase ne sont pas transférables : on crée des `members/{ancien uid}`
// inertes (personne ne peut se connecter avec) pour que le journal garde le nom des
// auteurs ; chacun rouvre son lien une fois pour se rattacher à sa nouvelle session.
//
// Usage (Node ≥ 22, exécution directe du TS) :
//   DATABASE_URL=postgresql://… node scripts/migrate-supabase-to-firestore.ts [--dry-run] [--project <id>]
// Cible :
//   - émulateur : FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 et --project demo-radasses ;
//   - cloud : GOOGLE_APPLICATION_CREDENTIALS=<clé de compte de service> et --project <id>.
// Seed local (liens démo `?token=demo-ete`, `?token=demo-we`) : lancer ce script sur la
// base Supabase locale (`npx supabase start`, seed.sql) vers l'émulateur.

import pg from 'pg';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const projectId = args.includes('--project') ? args[args.indexOf('--project') + 1] : undefined;
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL manquant (chaîne de connexion Postgres Supabase).');

// Types Postgres → JS : bigint/numeric en nombres, date en 'YYYY-MM-DD', timestamptz en ISO.
pg.types.setTypeParser(20, Number); // int8
pg.types.setTypeParser(1700, Number); // numeric
pg.types.setTypeParser(1082, (v) => v); // date
pg.types.setTypeParser(1184, (v) => new Date(v).toISOString()); // timestamptz

const client = new pg.Client({ connectionString: databaseUrl });
await client.connect();
const rows = async <T>(sql: string) => (await client.query(sql)).rows as T[];

type Row = Record<string, unknown>;
const trips = await rows<Row>('select * from trips order by created_at');
const households = await rows<Row>('select * from households');
const persons = await rows<Row>('select * from persons');
const participants = await rows<Row>('select * from trip_participants order by created_at');
const access = await rows<Row>('select * from participant_access order by created_at');
const expenses = await rows<Row>('select * from expenses');
const beneficiaries = await rows<Row>('select * from expense_beneficiaries');
const operations = await rows<Row>('select * from operations order by id');
await client.end();

const byTrip = (list: Row[], t: unknown) => list.filter((r) => r.trip_id === t);
const pick = (r: Row, keys: string[]) => Object.fromEntries(keys.map((k) => [k, r[k] ?? null]));

type Write = { path: string; data: Row };
const writes: Write[] = [];
const put = (path: string, data: Row) => writes.push({ path, data });

for (const trip of trips) {
	const t = trip.id as string;
	const tParts = byTrip(participants, t);
	const tAccess = access.filter((a) => tParts.some((p) => p.id === a.trip_participant_id));
	const tOps = byTrip(operations, t);
	const nameOf = (list: Row[], id: unknown) =>
		(list.find((r) => r.id === id)?.name as string) ?? '?';

	put(`trips/${t}`, {
		name: trip.name,
		currency: trip.currency,
		created_at: trip.created_at,
		created_by: (tAccess[0]?.auth_user_id as string) ?? 'legacy',
		join_token: trip.join_token,
		op_seq: tOps.length
	});
	for (const h of byTrip(households, t))
		put(`trips/${t}/households/${h.id}`, pick(h, ['trip_id', 'name', 'created_at']));
	for (const p of byTrip(persons, t))
		put(`trips/${t}/persons/${p.id}`, pick(p, ['trip_id', 'name', 'created_at']));

	const candidates: Record<string, Row> = {};
	for (const p of tParts) {
		put(
			`trips/${t}/participants/${p.id}`,
			pick(p, [
				'trip_id',
				'person_id',
				'household_id',
				'default_weight',
				'active',
				'invite_token',
				'created_at'
			])
		);
		put(`inviteTokens/${p.invite_token}`, { trip_id: t, participant_id: p.id });
		candidates[p.id as string] = {
			person_name: nameOf(persons, p.person_id),
			household_name: nameOf(households, p.household_id),
			created_at: p.created_at
		};
	}
	put(`joinTokens/${trip.join_token}`, { trip_id: t, candidates });

	// Adhésions héritées (inertes) + identités « déjà réclamées ».
	const seenUid = new Set<string>();
	for (const a of tAccess) {
		const uid = a.auth_user_id as string;
		put(`joinTokens/${trip.join_token}/claims/${a.trip_participant_id}`, { uid });
		if (seenUid.has(uid)) continue;
		seenUid.add(uid);
		put(`trips/${t}/members/${uid}`, {
			uid,
			trip_id: t,
			participant_id: a.trip_participant_id,
			legacy: true
		});
	}

	for (const e of byTrip(expenses, t)) {
		put(`trips/${t}/expenses/${e.id}`, {
			...pick(e, [
				'trip_id',
				'description',
				'category',
				'amount_cents',
				'spent_on',
				'paid_by_person_id',
				'version',
				'created_at',
				'updated_at',
				'deleted_at'
			]),
			created_by: (e.created_by as string) ?? 'legacy',
			beneficiaries: beneficiaries
				.filter((b) => b.expense_id === e.id)
				.map((b) => pick(b, ['person_id', 'is_locked', 'weight', 'amount_cents']))
		});
	}

	tOps.forEach((o, i) =>
		put(`trips/${t}/ops/${i + 1}`, {
			id: i + 1,
			trip_id: t,
			actor_auth_user_id: o.actor_auth_user_id ?? null,
			entity_type: o.entity_type,
			entity_id: o.entity_id ?? null,
			action: o.action,
			before: o.before ?? null,
			after: o.after ?? null,
			created_at: o.created_at
		})
	);
}

console.log(
	`${trips.length} séjours, ${participants.length} participants, ${expenses.length} dépenses, ` +
		`${operations.length} opérations → ${writes.length} documents Firestore.`
);
if (dryRun) {
	console.log('--dry-run : rien n’est écrit.');
	process.exit(0);
}

initializeApp(projectId ? { projectId } : undefined);
const fs = getFirestore();
const writer = fs.bulkWriter();
for (const w of writes) void writer.set(fs.doc(w.path), w.data);
await writer.close();
console.log(`Écrit dans le projet ${projectId ?? '(par défaut)'}.`);
