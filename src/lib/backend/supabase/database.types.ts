// Généré par `npm run gen:db-types` (supabase gen types typescript --local) — NE PAS ÉDITER À LA MAIN.
// Regénérer après chaque migration touchant le schéma public (tables/vues/fonctions).

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
	graphql_public: {
		Tables: {
			[_ in never]: never;
		};
		Views: {
			[_ in never]: never;
		};
		Functions: {
			graphql: {
				Args: {
					extensions?: Json;
					operationName?: string;
					query?: string;
					variables?: Json;
				};
				Returns: Json;
			};
		};
		Enums: {
			[_ in never]: never;
		};
		CompositeTypes: {
			[_ in never]: never;
		};
	};
	public: {
		Tables: {
			expense_beneficiaries: {
				Row: {
					amount_cents: number;
					expense_id: string;
					id: string;
					is_locked: boolean;
					person_id: string;
					trip_id: string;
					weight: number | null;
				};
				Insert: {
					amount_cents?: number;
					expense_id: string;
					id?: string;
					is_locked?: boolean;
					person_id: string;
					trip_id: string;
					weight?: number | null;
				};
				Update: {
					amount_cents?: number;
					expense_id?: string;
					id?: string;
					is_locked?: boolean;
					person_id?: string;
					trip_id?: string;
					weight?: number | null;
				};
				Relationships: [
					{
						foreignKeyName: 'expense_beneficiaries_expense_id_fkey';
						columns: ['expense_id'];
						isOneToOne: false;
						referencedRelation: 'expenses';
						referencedColumns: ['id'];
					},
					{
						foreignKeyName: 'expense_beneficiaries_trip_id_person_id_fkey';
						columns: ['trip_id', 'person_id'];
						isOneToOne: false;
						referencedRelation: 'trip_participants';
						referencedColumns: ['trip_id', 'person_id'];
					}
				];
			};
			expenses: {
				Row: {
					amount_cents: number;
					category: string | null;
					created_at: string;
					created_by: string | null;
					deleted_at: string | null;
					description: string;
					id: string;
					paid_by_person_id: string;
					spent_on: string;
					trip_id: string;
					updated_at: string;
					version: number;
				};
				Insert: {
					amount_cents: number;
					category?: string | null;
					created_at?: string;
					created_by?: string | null;
					deleted_at?: string | null;
					description?: string;
					id?: string;
					paid_by_person_id: string;
					spent_on?: string;
					trip_id: string;
					updated_at?: string;
					version?: number;
				};
				Update: {
					amount_cents?: number;
					category?: string | null;
					created_at?: string;
					created_by?: string | null;
					deleted_at?: string | null;
					description?: string;
					id?: string;
					paid_by_person_id?: string;
					spent_on?: string;
					trip_id?: string;
					updated_at?: string;
					version?: number;
				};
				Relationships: [
					{
						foreignKeyName: 'expenses_trip_id_fkey';
						columns: ['trip_id'];
						isOneToOne: false;
						referencedRelation: 'trips';
						referencedColumns: ['id'];
					},
					{
						foreignKeyName: 'expenses_trip_id_paid_by_person_id_fkey';
						columns: ['trip_id', 'paid_by_person_id'];
						isOneToOne: false;
						referencedRelation: 'trip_participants';
						referencedColumns: ['trip_id', 'person_id'];
					}
				];
			};
			households: {
				Row: {
					created_at: string;
					id: string;
					name: string;
					trip_id: string;
				};
				Insert: {
					created_at?: string;
					id?: string;
					name: string;
					trip_id: string;
				};
				Update: {
					created_at?: string;
					id?: string;
					name?: string;
					trip_id?: string;
				};
				Relationships: [
					{
						foreignKeyName: 'households_trip_id_fkey';
						columns: ['trip_id'];
						isOneToOne: false;
						referencedRelation: 'trips';
						referencedColumns: ['id'];
					}
				];
			};
			operations: {
				Row: {
					action: string;
					actor_auth_user_id: string | null;
					after: Json | null;
					before: Json | null;
					created_at: string;
					entity_id: string | null;
					entity_type: string;
					id: number;
					trip_id: string;
				};
				Insert: {
					action: string;
					actor_auth_user_id?: string | null;
					after?: Json | null;
					before?: Json | null;
					created_at?: string;
					entity_id?: string | null;
					entity_type: string;
					id?: never;
					trip_id: string;
				};
				Update: {
					action?: string;
					actor_auth_user_id?: string | null;
					after?: Json | null;
					before?: Json | null;
					created_at?: string;
					entity_id?: string | null;
					entity_type?: string;
					id?: never;
					trip_id?: string;
				};
				Relationships: [
					{
						foreignKeyName: 'operations_trip_id_fkey';
						columns: ['trip_id'];
						isOneToOne: false;
						referencedRelation: 'trips';
						referencedColumns: ['id'];
					}
				];
			};
			participant_access: {
				Row: {
					auth_user_id: string;
					created_at: string;
					trip_participant_id: string;
				};
				Insert: {
					auth_user_id: string;
					created_at?: string;
					trip_participant_id: string;
				};
				Update: {
					auth_user_id?: string;
					created_at?: string;
					trip_participant_id?: string;
				};
				Relationships: [
					{
						foreignKeyName: 'participant_access_trip_participant_id_fkey';
						columns: ['trip_participant_id'];
						isOneToOne: false;
						referencedRelation: 'trip_participants';
						referencedColumns: ['id'];
					}
				];
			};
			persons: {
				Row: {
					created_at: string;
					id: string;
					name: string;
					trip_id: string;
				};
				Insert: {
					created_at?: string;
					id?: string;
					name: string;
					trip_id: string;
				};
				Update: {
					created_at?: string;
					id?: string;
					name?: string;
					trip_id?: string;
				};
				Relationships: [
					{
						foreignKeyName: 'persons_trip_id_fkey';
						columns: ['trip_id'];
						isOneToOne: false;
						referencedRelation: 'trips';
						referencedColumns: ['id'];
					}
				];
			};
			trip_participants: {
				Row: {
					active: boolean;
					created_at: string;
					default_weight: number;
					household_id: string;
					id: string;
					invite_token: string;
					person_id: string;
					trip_id: string;
				};
				Insert: {
					active?: boolean;
					created_at?: string;
					default_weight?: number;
					household_id: string;
					id?: string;
					invite_token?: string;
					person_id: string;
					trip_id: string;
				};
				Update: {
					active?: boolean;
					created_at?: string;
					default_weight?: number;
					household_id?: string;
					id?: string;
					invite_token?: string;
					person_id?: string;
					trip_id?: string;
				};
				Relationships: [
					{
						foreignKeyName: 'trip_participants_household_id_fkey';
						columns: ['household_id'];
						isOneToOne: false;
						referencedRelation: 'households';
						referencedColumns: ['id'];
					},
					{
						foreignKeyName: 'trip_participants_person_id_fkey';
						columns: ['person_id'];
						isOneToOne: false;
						referencedRelation: 'persons';
						referencedColumns: ['id'];
					},
					{
						foreignKeyName: 'trip_participants_trip_id_fkey';
						columns: ['trip_id'];
						isOneToOne: false;
						referencedRelation: 'trips';
						referencedColumns: ['id'];
					}
				];
			};
			trips: {
				Row: {
					created_at: string;
					currency: string;
					id: string;
					join_token: string;
					name: string;
				};
				Insert: {
					created_at?: string;
					currency?: string;
					id?: string;
					join_token?: string;
					name: string;
				};
				Update: {
					created_at?: string;
					currency?: string;
					id?: string;
					join_token?: string;
					name?: string;
				};
				Relationships: [];
			};
		};
		Views: {
			balances: {
				Row: {
					household_id: string | null;
					net_cents: number | null;
					trip_id: string | null;
				};
				Relationships: [
					{
						foreignKeyName: 'trip_participants_household_id_fkey';
						columns: ['household_id'];
						isOneToOne: false;
						referencedRelation: 'households';
						referencedColumns: ['id'];
					},
					{
						foreignKeyName: 'trip_participants_trip_id_fkey';
						columns: ['trip_id'];
						isOneToOne: false;
						referencedRelation: 'trips';
						referencedColumns: ['id'];
					}
				];
			};
		};
		Functions: {
			add_participant: {
				Args: {
					p_default_weight?: number;
					p_household_id?: string;
					p_household_name?: string;
					p_person_name: string;
					p_trip_id: string;
				};
				Returns: Json;
			};
			assert_trip_access: { Args: { p_trip_id: string }; Returns: undefined };
			can_see_household: { Args: { p_household_id: string }; Returns: boolean };
			can_see_person: { Args: { p_person_id: string }; Returns: boolean };
			claim_participant: {
				Args: { p_join_token: string; p_participant_id: string };
				Returns: string;
			};
			compute_split: {
				Args: { p_amount_cents: number; p_beneficiaries: Json };
				Returns: Json;
			};
			create_trip: {
				Args: {
					p_currency: string;
					p_my_household_name: string;
					p_my_name: string;
					p_name: string;
				};
				Returns: Json;
			};
			delete_expense: {
				Args: {
					p_expected_version?: number;
					p_expense_id: string;
					p_trip_id: string;
				};
				Returns: Json;
			};
			is_trip_member: { Args: { p_trip_id: string }; Returns: boolean };
			list_join_candidates: {
				Args: { p_join_token: string };
				Returns: {
					claimed: boolean;
					household_name: string;
					participant_id: string;
					person_name: string;
				}[];
			};
			redeem_token: { Args: { p_token: string }; Returns: string };
			save_expense: {
				Args: {
					p_amount_cents: number;
					p_beneficiaries: Json;
					p_category?: string;
					p_description?: string;
					p_expected_version?: number;
					p_expense_id?: string;
					p_paid_by_person_id: string;
					p_spent_on?: string;
					p_trip_id: string;
				};
				Returns: Json;
			};
		};
		Enums: {
			[_ in never]: never;
		};
		CompositeTypes: {
			[_ in never]: never;
		};
	};
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>];

export type Tables<
	DefaultSchemaTableNameOrOptions extends
		| keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
		| { schema: keyof DatabaseWithoutInternals },
	TableName extends (DefaultSchemaTableNameOrOptions extends {
		schema: keyof DatabaseWithoutInternals;
	}
		? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
				DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
		: never) = never
> = DefaultSchemaTableNameOrOptions extends {
	schema: keyof DatabaseWithoutInternals;
}
	? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
			DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
			Row: infer R;
		}
		? R
		: never
	: DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
		? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
				Row: infer R;
			}
			? R
			: never
		: never;

export type TablesInsert<
	DefaultSchemaTableNameOrOptions extends
		keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
	TableName extends (DefaultSchemaTableNameOrOptions extends {
		schema: keyof DatabaseWithoutInternals;
	}
		? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
		: never) = never
> = DefaultSchemaTableNameOrOptions extends {
	schema: keyof DatabaseWithoutInternals;
}
	? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
			Insert: infer I;
		}
		? I
		: never
	: DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
		? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
				Insert: infer I;
			}
			? I
			: never
		: never;

export type TablesUpdate<
	DefaultSchemaTableNameOrOptions extends
		keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
	TableName extends (DefaultSchemaTableNameOrOptions extends {
		schema: keyof DatabaseWithoutInternals;
	}
		? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
		: never) = never
> = DefaultSchemaTableNameOrOptions extends {
	schema: keyof DatabaseWithoutInternals;
}
	? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
			Update: infer U;
		}
		? U
		: never
	: DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
		? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
				Update: infer U;
			}
			? U
			: never
		: never;

export type Enums<
	DefaultSchemaEnumNameOrOptions extends
		keyof DefaultSchema['Enums'] | { schema: keyof DatabaseWithoutInternals },
	EnumName extends (DefaultSchemaEnumNameOrOptions extends {
		schema: keyof DatabaseWithoutInternals;
	}
		? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
		: never) = never
> = DefaultSchemaEnumNameOrOptions extends {
	schema: keyof DatabaseWithoutInternals;
}
	? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
	: DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
		? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
		: never;

export type CompositeTypes<
	PublicCompositeTypeNameOrOptions extends
		keyof DefaultSchema['CompositeTypes'] | { schema: keyof DatabaseWithoutInternals },
	CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
		schema: keyof DatabaseWithoutInternals;
	}
		? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
		: never) = never
> = PublicCompositeTypeNameOrOptions extends {
	schema: keyof DatabaseWithoutInternals;
}
	? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
	: PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
		? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
		: never;

export const Constants = {
	graphql_public: {
		Enums: {}
	},
	public: {
		Enums: {}
	}
} as const;
