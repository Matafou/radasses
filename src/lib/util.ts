/** Message lisible d'une erreur inconnue (catch) : `Error.message`, sinon `String(e)`.
 *  Factorise le motif répété `e instanceof Error ? e.message : String(e)`. */
export function errMessage(e: unknown): string {
	return e instanceof Error ? e.message : String(e);
}
