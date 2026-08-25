export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      access_reveal_logs: {
        Row: {
          access_granted: boolean
          created_at: string
          device_info: string | null
          expires_at: string | null
          field_accessed: string
          geolocation: string | null
          id: string
          ip_address: string | null
          participant_id: string
          reason: string
          user_id: string
        }
        Insert: {
          access_granted?: boolean
          created_at?: string
          device_info?: string | null
          expires_at?: string | null
          field_accessed: string
          geolocation?: string | null
          id?: string
          ip_address?: string | null
          participant_id: string
          reason: string
          user_id: string
        }
        Update: {
          access_granted?: boolean
          created_at?: string
          device_info?: string | null
          expires_at?: string | null
          field_accessed?: string
          geolocation?: string | null
          id?: string
          ip_address?: string | null
          participant_id?: string
          reason?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "access_reveal_logs_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_activity_logs: {
        Row: {
          action_taken: string
          confidence_score: number | null
          created_at: string
          human_reviewer_id: string | null
          id: string
          organisation_id: string | null
          result: Json | null
          reviewed_at: string | null
          source_data_ref: string | null
          suggestion: string | null
          trigger_reason: string
        }
        Insert: {
          action_taken: string
          confidence_score?: number | null
          created_at?: string
          human_reviewer_id?: string | null
          id?: string
          organisation_id?: string | null
          result?: Json | null
          reviewed_at?: string | null
          source_data_ref?: string | null
          suggestion?: string | null
          trigger_reason: string
        }
        Update: {
          action_taken?: string
          confidence_score?: number | null
          created_at?: string
          human_reviewer_id?: string | null
          id?: string
          organisation_id?: string | null
          result?: Json | null
          reviewed_at?: string | null
          source_data_ref?: string | null
          suggestion?: string | null
          trigger_reason?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_activity_logs_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      alerts: {
        Row: {
          alert_type: string
          assigned_to: string | null
          created_at: string
          id: string
          is_read: boolean
          message: string | null
          organisation_id: string | null
          severity: string
          source_module: string | null
          source_record_id: string | null
          title: string
        }
        Insert: {
          alert_type: string
          assigned_to?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string | null
          organisation_id?: string | null
          severity?: string
          source_module?: string | null
          source_record_id?: string | null
          title: string
        }
        Update: {
          alert_type?: string
          assigned_to?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string | null
          organisation_id?: string | null
          severity?: string
          source_module?: string | null
          source_record_id?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "alerts_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      approvals: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          id: string
          notes: string | null
          organisation_id: string
          record_id: string
          record_type: string
          required_role: string
          status: string
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          organisation_id: string
          record_id: string
          record_type: string
          required_role?: string
          status?: string
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          organisation_id?: string
          record_id?: string
          record_type?: string
          required_role?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "approvals_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          device_info: string | null
          geolocation: string | null
          id: string
          ip_address: string | null
          module: string
          organisation_id: string | null
          record_id: string | null
          severity: string
          user_id: string | null
          user_name: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          device_info?: string | null
          geolocation?: string | null
          id?: string
          ip_address?: string | null
          module: string
          organisation_id?: string | null
          record_id?: string | null
          severity?: string
          user_id?: string | null
          user_name?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          device_info?: string | null
          geolocation?: string | null
          id?: string
          ip_address?: string | null
          module?: string
          organisation_id?: string | null
          record_id?: string | null
          severity?: string
          user_id?: string | null
          user_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      business_categories: {
        Row: {
          active: boolean
          code: string
          created_at: string
          description: string | null
          display_order: number
          id: string
          name: string
          requires_ndis_registration: boolean
          updated_at: string
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          name: string
          requires_ndis_registration?: boolean
          updated_at?: string
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          name?: string
          requires_ndis_registration?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      certifications: {
        Row: {
          certificate_url: string | null
          created_at: string
          expiry_date: string | null
          id: string
          issue_date: string
          issuer: string | null
          name: string
          organisation_id: string | null
          qualification_type:
            | Database["public"]["Enums"]["qualification_type"]
            | null
          role_requirement: Json | null
          status: string
          user_id: string
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          certificate_url?: string | null
          created_at?: string
          expiry_date?: string | null
          id?: string
          issue_date: string
          issuer?: string | null
          name: string
          organisation_id?: string | null
          qualification_type?:
            | Database["public"]["Enums"]["qualification_type"]
            | null
          role_requirement?: Json | null
          status?: string
          user_id: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          certificate_url?: string | null
          created_at?: string
          expiry_date?: string | null
          id?: string
          issue_date?: string
          issuer?: string | null
          name?: string
          organisation_id?: string | null
          qualification_type?:
            | Database["public"]["Enums"]["qualification_type"]
            | null
          role_requirement?: Json | null
          status?: string
          user_id?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "certifications_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      check_templates: {
        Row: {
          category: string
          created_at: string
          frequency: string
          id: string
          instructions: string | null
          is_active: boolean
          name: string
          organisation_id: string
          updated_at: string
        }
        Insert: {
          category: string
          created_at?: string
          frequency?: string
          id?: string
          instructions?: string | null
          is_active?: boolean
          name: string
          organisation_id: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          frequency?: string
          id?: string
          instructions?: string | null
          is_active?: boolean
          name?: string
          organisation_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "check_templates_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      complaint_workflow_history: {
        Row: {
          changed_by: string
          complaint_id: string
          created_at: string
          from_status: Database["public"]["Enums"]["complaint_status"] | null
          id: string
          notes: string | null
          to_status: Database["public"]["Enums"]["complaint_status"]
        }
        Insert: {
          changed_by: string
          complaint_id: string
          created_at?: string
          from_status?: Database["public"]["Enums"]["complaint_status"] | null
          id?: string
          notes?: string | null
          to_status: Database["public"]["Enums"]["complaint_status"]
        }
        Update: {
          changed_by?: string
          complaint_id?: string
          created_at?: string
          from_status?: Database["public"]["Enums"]["complaint_status"] | null
          id?: string
          notes?: string | null
          to_status?: Database["public"]["Enums"]["complaint_status"]
        }
        Relationships: [
          {
            foreignKeyName: "complaint_workflow_history_complaint_id_fkey"
            columns: ["complaint_id"]
            isOneToOne: false
            referencedRelation: "complaints"
            referencedColumns: ["id"]
          },
        ]
      }
      complaints: {
        Row: {
          acknowledgement_date: string | null
          anonymous: boolean | null
          assigned_handler: string | null
          assigned_to: string | null
          complainant_name: string | null
          complaint_category: string | null
          complaint_number: string
          complaint_source: string | null
          created_at: string
          description: string | null
          escalation_required: boolean | null
          final_outcome: string | null
          id: string
          immediate_risk_identified: boolean | null
          investigation_summary: string | null
          linked_staff_id: string | null
          organisation_id: string
          outcome_communicated_date: string | null
          participant_id: string | null
          priority: string
          record_status: Database["public"]["Enums"]["record_status"]
          requested_outcome: string | null
          resolution_actions: string | null
          resolved_at: string | null
          sensitivity_level: Database["public"]["Enums"]["sensitivity_level"]
          status: Database["public"]["Enums"]["complaint_status"]
          subject: string
          submission_channel: string | null
          submitted_by: string | null
          submitted_by_name: string | null
          team_id: string | null
          updated_at: string
        }
        Insert: {
          acknowledgement_date?: string | null
          anonymous?: boolean | null
          assigned_handler?: string | null
          assigned_to?: string | null
          complainant_name?: string | null
          complaint_category?: string | null
          complaint_number: string
          complaint_source?: string | null
          created_at?: string
          description?: string | null
          escalation_required?: boolean | null
          final_outcome?: string | null
          id?: string
          immediate_risk_identified?: boolean | null
          investigation_summary?: string | null
          linked_staff_id?: string | null
          organisation_id: string
          outcome_communicated_date?: string | null
          participant_id?: string | null
          priority?: string
          record_status?: Database["public"]["Enums"]["record_status"]
          requested_outcome?: string | null
          resolution_actions?: string | null
          resolved_at?: string | null
          sensitivity_level?: Database["public"]["Enums"]["sensitivity_level"]
          status?: Database["public"]["Enums"]["complaint_status"]
          subject: string
          submission_channel?: string | null
          submitted_by?: string | null
          submitted_by_name?: string | null
          team_id?: string | null
          updated_at?: string
        }
        Update: {
          acknowledgement_date?: string | null
          anonymous?: boolean | null
          assigned_handler?: string | null
          assigned_to?: string | null
          complainant_name?: string | null
          complaint_category?: string | null
          complaint_number?: string
          complaint_source?: string | null
          created_at?: string
          description?: string | null
          escalation_required?: boolean | null
          final_outcome?: string | null
          id?: string
          immediate_risk_identified?: boolean | null
          investigation_summary?: string | null
          linked_staff_id?: string | null
          organisation_id?: string
          outcome_communicated_date?: string | null
          participant_id?: string | null
          priority?: string
          record_status?: Database["public"]["Enums"]["record_status"]
          requested_outcome?: string | null
          resolution_actions?: string | null
          resolved_at?: string | null
          sensitivity_level?: Database["public"]["Enums"]["sensitivity_level"]
          status?: Database["public"]["Enums"]["complaint_status"]
          subject?: string
          submission_channel?: string | null
          submitted_by?: string | null
          submitted_by_name?: string | null
          team_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "complaints_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "complaints_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "complaints_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      compliance_requirement_rules: {
        Row: {
          active: boolean
          business_category_id: string | null
          condition_json: Json | null
          created_at: string
          id: string
          label: string | null
          required: boolean
          requirement_reference: string
          requirement_type: string
          service_type_id: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          business_category_id?: string | null
          condition_json?: Json | null
          created_at?: string
          id?: string
          label?: string | null
          required?: boolean
          requirement_reference: string
          requirement_type: string
          service_type_id?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          business_category_id?: string | null
          condition_json?: Json | null
          created_at?: string
          id?: string
          label?: string | null
          required?: boolean
          requirement_reference?: string
          requirement_type?: string
          service_type_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "compliance_requirement_rules_business_category_id_fkey"
            columns: ["business_category_id"]
            isOneToOne: false
            referencedRelation: "business_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliance_requirement_rules_service_type_id_fkey"
            columns: ["service_type_id"]
            isOneToOne: false
            referencedRelation: "service_types"
            referencedColumns: ["id"]
          },
        ]
      }
      conflict_of_interest_declarations: {
        Row: {
          created_at: string
          declaration_type: string
          declared_at: string
          description: string | null
          has_conflict: boolean
          id: string
          mitigation: string | null
          organisation_id: string
          reviewed_at: string | null
          reviewed_by: string | null
          secondary_employment: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          declaration_type?: string
          declared_at?: string
          description?: string | null
          has_conflict?: boolean
          id?: string
          mitigation?: string | null
          organisation_id: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          secondary_employment?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          declaration_type?: string
          declared_at?: string
          description?: string | null
          has_conflict?: boolean
          id?: string
          mitigation?: string | null
          organisation_id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          secondary_employment?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conflict_of_interest_declarations_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      controls_matrix: {
        Row: {
          created_at: string
          created_by: string
          evidence_description: string | null
          evidence_table: string | null
          id: string
          linked_policy_id: string | null
          organisation_id: string
          practice_standard_id: string
          quality_indicator: string
          record_status: Database["public"]["Enums"]["record_status"]
          updated_at: string
          workflow_module: string | null
        }
        Insert: {
          created_at?: string
          created_by: string
          evidence_description?: string | null
          evidence_table?: string | null
          id?: string
          linked_policy_id?: string | null
          organisation_id: string
          practice_standard_id: string
          quality_indicator: string
          record_status?: Database["public"]["Enums"]["record_status"]
          updated_at?: string
          workflow_module?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string
          evidence_description?: string | null
          evidence_table?: string | null
          id?: string
          linked_policy_id?: string | null
          organisation_id?: string
          practice_standard_id?: string
          quality_indicator?: string
          record_status?: Database["public"]["Enums"]["record_status"]
          updated_at?: string
          workflow_module?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "controls_matrix_linked_policy_id_fkey"
            columns: ["linked_policy_id"]
            isOneToOne: false
            referencedRelation: "policies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "controls_matrix_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "controls_matrix_practice_standard_id_fkey"
            columns: ["practice_standard_id"]
            isOneToOne: false
            referencedRelation: "practice_standards"
            referencedColumns: ["id"]
          },
        ]
      }
      environment_checks: {
        Row: {
          cleaning_completed: boolean
          created_at: string
          escalated: boolean
          follow_up_action: string | null
          hazards_identified: string | null
          id: string
          infection_control_ok: boolean
          location: string
          next_due_date: string | null
          organisation_id: string
          passed: boolean
          performed_at: string
          performed_by: string | null
          ppe_available: boolean
          template_id: string | null
          updated_at: string
        }
        Insert: {
          cleaning_completed?: boolean
          created_at?: string
          escalated?: boolean
          follow_up_action?: string | null
          hazards_identified?: string | null
          id?: string
          infection_control_ok?: boolean
          location: string
          next_due_date?: string | null
          organisation_id: string
          passed?: boolean
          performed_at?: string
          performed_by?: string | null
          ppe_available?: boolean
          template_id?: string | null
          updated_at?: string
        }
        Update: {
          cleaning_completed?: boolean
          created_at?: string
          escalated?: boolean
          follow_up_action?: string | null
          hazards_identified?: string | null
          id?: string
          infection_control_ok?: boolean
          location?: string
          next_due_date?: string | null
          organisation_id?: string
          passed?: boolean
          performed_at?: string
          performed_by?: string | null
          ppe_available?: boolean
          template_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "environment_checks_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "environment_checks_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "check_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      evidence_requirement_links: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          organisation_id: string
          record_id: string | null
          record_label: string | null
          record_type: string
          requirement_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          organisation_id: string
          record_id?: string | null
          record_label?: string | null
          record_type: string
          requirement_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          organisation_id?: string
          record_id?: string | null
          record_label?: string | null
          record_type?: string
          requirement_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "evidence_requirement_links_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evidence_requirement_links_requirement_id_fkey"
            columns: ["requirement_id"]
            isOneToOne: false
            referencedRelation: "evidence_requirements"
            referencedColumns: ["id"]
          },
        ]
      }
      evidence_requirements: {
        Row: {
          auditor_notes: string | null
          created_at: string
          created_by: string | null
          id: string
          include_in_export: boolean
          linked_policy_id: string | null
          linked_policy_version: number | null
          module_code: string | null
          organisation_id: string
          outcome_code: string
          owner_id: string | null
          quality_indicator: string | null
          record_status: Database["public"]["Enums"]["record_status"]
          required_evidence_type: string
          requirement_title: string
          requires_human_review: boolean
          review_date: string | null
          standards_effective_date: string
          standards_version: string
          status: Database["public"]["Enums"]["evidence_status"]
          updated_at: string
        }
        Insert: {
          auditor_notes?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          include_in_export?: boolean
          linked_policy_id?: string | null
          linked_policy_version?: number | null
          module_code?: string | null
          organisation_id: string
          outcome_code: string
          owner_id?: string | null
          quality_indicator?: string | null
          record_status?: Database["public"]["Enums"]["record_status"]
          required_evidence_type: string
          requirement_title: string
          requires_human_review?: boolean
          review_date?: string | null
          standards_effective_date?: string
          standards_version?: string
          status?: Database["public"]["Enums"]["evidence_status"]
          updated_at?: string
        }
        Update: {
          auditor_notes?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          include_in_export?: boolean
          linked_policy_id?: string | null
          linked_policy_version?: number | null
          module_code?: string | null
          organisation_id?: string
          outcome_code?: string
          owner_id?: string | null
          quality_indicator?: string | null
          record_status?: Database["public"]["Enums"]["record_status"]
          required_evidence_type?: string
          requirement_title?: string
          requires_human_review?: boolean
          review_date?: string | null
          standards_effective_date?: string
          standards_version?: string
          status?: Database["public"]["Enums"]["evidence_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "evidence_requirements_linked_policy_id_fkey"
            columns: ["linked_policy_id"]
            isOneToOne: false
            referencedRelation: "policies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evidence_requirements_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evidence_requirements_outcome_code_fkey"
            columns: ["outcome_code"]
            isOneToOne: false
            referencedRelation: "practice_outcomes"
            referencedColumns: ["outcome_code"]
          },
        ]
      }
      governance_actions: {
        Row: {
          action: string
          completed_at: string | null
          created_at: string
          due_date: string | null
          id: string
          meeting_id: string | null
          notes: string | null
          organisation_id: string
          owner_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          action: string
          completed_at?: string | null
          created_at?: string
          due_date?: string | null
          id?: string
          meeting_id?: string | null
          notes?: string | null
          organisation_id: string
          owner_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          action?: string
          completed_at?: string | null
          created_at?: string
          due_date?: string | null
          id?: string
          meeting_id?: string | null
          notes?: string | null
          organisation_id?: string
          owner_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "governance_actions_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "governance_meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "governance_actions_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      governance_meetings: {
        Row: {
          agenda: string | null
          attendees: Json
          created_at: string
          decisions: string | null
          id: string
          meeting_date: string
          meeting_type: string
          minutes: string | null
          next_meeting_date: string | null
          organisation_id: string
          record_status: Database["public"]["Enums"]["record_status"]
          recorded_by: string | null
          updated_at: string
        }
        Insert: {
          agenda?: string | null
          attendees?: Json
          created_at?: string
          decisions?: string | null
          id?: string
          meeting_date: string
          meeting_type?: string
          minutes?: string | null
          next_meeting_date?: string | null
          organisation_id: string
          record_status?: Database["public"]["Enums"]["record_status"]
          recorded_by?: string | null
          updated_at?: string
        }
        Update: {
          agenda?: string | null
          attendees?: Json
          created_at?: string
          decisions?: string | null
          id?: string
          meeting_date?: string
          meeting_type?: string
          minutes?: string | null
          next_meeting_date?: string | null
          organisation_id?: string
          record_status?: Database["public"]["Enums"]["record_status"]
          recorded_by?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "governance_meetings_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      incident_actions: {
        Row: {
          action_type: string
          assigned_to: string | null
          capa_type: string
          closed_at: string | null
          completed_at: string | null
          corrective_action: string | null
          created_at: string
          created_by: string
          description: string
          due_date: string | null
          effectiveness_review: string | null
          id: string
          incident_id: string
          notes: string | null
          preventive_action: string | null
          root_cause: string | null
          status: string
          updated_at: string
        }
        Insert: {
          action_type?: string
          assigned_to?: string | null
          capa_type?: string
          closed_at?: string | null
          completed_at?: string | null
          corrective_action?: string | null
          created_at?: string
          created_by: string
          description: string
          due_date?: string | null
          effectiveness_review?: string | null
          id?: string
          incident_id: string
          notes?: string | null
          preventive_action?: string | null
          root_cause?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          action_type?: string
          assigned_to?: string | null
          capa_type?: string
          closed_at?: string | null
          completed_at?: string | null
          corrective_action?: string | null
          created_at?: string
          created_by?: string
          description?: string
          due_date?: string | null
          effectiveness_review?: string | null
          id?: string
          incident_id?: string
          notes?: string | null
          preventive_action?: string | null
          root_cause?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "incident_actions_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "incidents"
            referencedColumns: ["id"]
          },
        ]
      }
      incident_training_links: {
        Row: {
          assigned_at: string
          assigned_by: string
          completed_at: string | null
          created_at: string
          id: string
          incident_id: string
          organisation_id: string
          staff_id: string
          status: string
          training_code: string
        }
        Insert: {
          assigned_at?: string
          assigned_by: string
          completed_at?: string | null
          created_at?: string
          id?: string
          incident_id: string
          organisation_id: string
          staff_id: string
          status?: string
          training_code: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string
          completed_at?: string | null
          created_at?: string
          id?: string
          incident_id?: string
          organisation_id?: string
          staff_id?: string
          status?: string
          training_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "incident_training_links_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "incidents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incident_training_links_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      incident_versions: {
        Row: {
          changed_by: string
          changes: Json
          created_at: string
          id: string
          incident_id: string
          version_number: number
        }
        Insert: {
          changed_by: string
          changes?: Json
          created_at?: string
          id?: string
          incident_id: string
          version_number: number
        }
        Update: {
          changed_by?: string
          changes?: Json
          created_at?: string
          id?: string
          incident_id?: string
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "incident_versions_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "incidents"
            referencedColumns: ["id"]
          },
        ]
      }
      incident_workflow_history: {
        Row: {
          changed_by: string
          created_at: string
          from_status: Database["public"]["Enums"]["incident_status"] | null
          id: string
          incident_id: string
          notes: string | null
          to_status: Database["public"]["Enums"]["incident_status"]
        }
        Insert: {
          changed_by: string
          created_at?: string
          from_status?: Database["public"]["Enums"]["incident_status"] | null
          id?: string
          incident_id: string
          notes?: string | null
          to_status: Database["public"]["Enums"]["incident_status"]
        }
        Update: {
          changed_by?: string
          created_at?: string
          from_status?: Database["public"]["Enums"]["incident_status"] | null
          id?: string
          incident_id?: string
          notes?: string | null
          to_status?: Database["public"]["Enums"]["incident_status"]
        }
        Relationships: [
          {
            foreignKeyName: "incident_workflow_history_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "incidents"
            referencedColumns: ["id"]
          },
        ]
      }
      incidents: {
        Row: {
          affected_person_support: string | null
          ai_suggested_classification: string | null
          assigned_investigator: string | null
          assigned_to: string | null
          closed_at: string | null
          closed_by: string | null
          closure_recommendation: string | null
          contributing_factors: string | null
          corrective_actions: string | null
          created_at: string
          current_participant_condition: string | null
          date_of_incident: string | null
          date_reported: string | null
          description: string | null
          emergency_service_contacted: boolean | null
          environment: string | null
          id: string
          immediate_action_taken: string | null
          immediate_safety_action: string | null
          incident_category: string | null
          incident_location: string | null
          incident_number: string
          incident_summary: string | null
          incident_type: string
          injury_involved: boolean
          investigation_required: boolean | null
          is_reportable: boolean
          linked_staff_id: string | null
          medical_attention_required: boolean | null
          ndis_notification_deadline: string | null
          organisation_id: string
          other_persons_involved: Json | null
          outcome_summary: string | null
          participant_communication: string | null
          participant_followup_completed: boolean | null
          participant_harmed: boolean | null
          participant_id: string | null
          practice_standard_id: string | null
          preventive_actions: string | null
          record_status: Database["public"]["Enums"]["record_status"]
          reportable_due_at: string | null
          reportable_reason: string | null
          reportable_status: string
          reported_by: string
          reporter_role: string | null
          root_cause: string | null
          sensitivity_level: Database["public"]["Enums"]["sensitivity_level"]
          severity: Database["public"]["Enums"]["incident_severity"]
          staff_harmed: boolean | null
          status: Database["public"]["Enums"]["incident_status"]
          sub_category: string | null
          supervisor_classification: string | null
          team_id: string | null
          time_of_incident: string | null
          title: string
          updated_at: string
          witnesses: Json | null
        }
        Insert: {
          affected_person_support?: string | null
          ai_suggested_classification?: string | null
          assigned_investigator?: string | null
          assigned_to?: string | null
          closed_at?: string | null
          closed_by?: string | null
          closure_recommendation?: string | null
          contributing_factors?: string | null
          corrective_actions?: string | null
          created_at?: string
          current_participant_condition?: string | null
          date_of_incident?: string | null
          date_reported?: string | null
          description?: string | null
          emergency_service_contacted?: boolean | null
          environment?: string | null
          id?: string
          immediate_action_taken?: string | null
          immediate_safety_action?: string | null
          incident_category?: string | null
          incident_location?: string | null
          incident_number: string
          incident_summary?: string | null
          incident_type: string
          injury_involved?: boolean
          investigation_required?: boolean | null
          is_reportable?: boolean
          linked_staff_id?: string | null
          medical_attention_required?: boolean | null
          ndis_notification_deadline?: string | null
          organisation_id: string
          other_persons_involved?: Json | null
          outcome_summary?: string | null
          participant_communication?: string | null
          participant_followup_completed?: boolean | null
          participant_harmed?: boolean | null
          participant_id?: string | null
          practice_standard_id?: string | null
          preventive_actions?: string | null
          record_status?: Database["public"]["Enums"]["record_status"]
          reportable_due_at?: string | null
          reportable_reason?: string | null
          reportable_status?: string
          reported_by: string
          reporter_role?: string | null
          root_cause?: string | null
          sensitivity_level?: Database["public"]["Enums"]["sensitivity_level"]
          severity?: Database["public"]["Enums"]["incident_severity"]
          staff_harmed?: boolean | null
          status?: Database["public"]["Enums"]["incident_status"]
          sub_category?: string | null
          supervisor_classification?: string | null
          team_id?: string | null
          time_of_incident?: string | null
          title: string
          updated_at?: string
          witnesses?: Json | null
        }
        Update: {
          affected_person_support?: string | null
          ai_suggested_classification?: string | null
          assigned_investigator?: string | null
          assigned_to?: string | null
          closed_at?: string | null
          closed_by?: string | null
          closure_recommendation?: string | null
          contributing_factors?: string | null
          corrective_actions?: string | null
          created_at?: string
          current_participant_condition?: string | null
          date_of_incident?: string | null
          date_reported?: string | null
          description?: string | null
          emergency_service_contacted?: boolean | null
          environment?: string | null
          id?: string
          immediate_action_taken?: string | null
          immediate_safety_action?: string | null
          incident_category?: string | null
          incident_location?: string | null
          incident_number?: string
          incident_summary?: string | null
          incident_type?: string
          injury_involved?: boolean
          investigation_required?: boolean | null
          is_reportable?: boolean
          linked_staff_id?: string | null
          medical_attention_required?: boolean | null
          ndis_notification_deadline?: string | null
          organisation_id?: string
          other_persons_involved?: Json | null
          outcome_summary?: string | null
          participant_communication?: string | null
          participant_followup_completed?: boolean | null
          participant_harmed?: boolean | null
          participant_id?: string | null
          practice_standard_id?: string | null
          preventive_actions?: string | null
          record_status?: Database["public"]["Enums"]["record_status"]
          reportable_due_at?: string | null
          reportable_reason?: string | null
          reportable_status?: string
          reported_by?: string
          reporter_role?: string | null
          root_cause?: string | null
          sensitivity_level?: Database["public"]["Enums"]["sensitivity_level"]
          severity?: Database["public"]["Enums"]["incident_severity"]
          staff_harmed?: boolean | null
          status?: Database["public"]["Enums"]["incident_status"]
          sub_category?: string | null
          supervisor_classification?: string | null
          team_id?: string | null
          time_of_incident?: string | null
          title?: string
          updated_at?: string
          witnesses?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "incidents_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidents_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidents_practice_standard_id_fkey"
            columns: ["practice_standard_id"]
            isOneToOne: false
            referencedRelation: "practice_standards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidents_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      internal_audits: {
        Row: {
          completed_date: string | null
          created_at: string
          findings: string | null
          id: string
          lead_auditor: string | null
          linked_outcome_code: string | null
          module: string | null
          organisation_id: string
          planned_date: string | null
          rating: string | null
          record_status: Database["public"]["Enums"]["record_status"]
          scope: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          completed_date?: string | null
          created_at?: string
          findings?: string | null
          id?: string
          lead_auditor?: string | null
          linked_outcome_code?: string | null
          module?: string | null
          organisation_id: string
          planned_date?: string | null
          rating?: string | null
          record_status?: Database["public"]["Enums"]["record_status"]
          scope?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          completed_date?: string | null
          created_at?: string
          findings?: string | null
          id?: string
          lead_auditor?: string | null
          linked_outcome_code?: string | null
          module?: string | null
          organisation_id?: string
          planned_date?: string | null
          rating?: string | null
          record_status?: Database["public"]["Enums"]["record_status"]
          scope?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "internal_audits_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      management_reviews: {
        Row: {
          actions: string | null
          chaired_by: string | null
          created_at: string
          decisions: string | null
          discussion: string | null
          id: string
          inputs: Json
          organisation_id: string
          period_covered: string | null
          review_date: string
          updated_at: string
        }
        Insert: {
          actions?: string | null
          chaired_by?: string | null
          created_at?: string
          decisions?: string | null
          discussion?: string | null
          id?: string
          inputs?: Json
          organisation_id: string
          period_covered?: string | null
          review_date: string
          updated_at?: string
        }
        Update: {
          actions?: string | null
          chaired_by?: string | null
          created_at?: string
          decisions?: string | null
          discussion?: string | null
          id?: string
          inputs?: Json
          organisation_id?: string
          period_covered?: string | null
          review_date?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "management_reviews_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      master_templates: {
        Row: {
          active: boolean
          body_template: string | null
          business_category_codes: string[]
          code: string
          created_at: string
          effective_date: string
          id: string
          name: string
          placeholder_fields: string[]
          registration_group_codes: string[]
          requirement_type: string
          review_date: string | null
          service_type_codes: string[]
          updated_at: string
          version: number
        }
        Insert: {
          active?: boolean
          body_template?: string | null
          business_category_codes?: string[]
          code: string
          created_at?: string
          effective_date?: string
          id?: string
          name: string
          placeholder_fields?: string[]
          registration_group_codes?: string[]
          requirement_type?: string
          review_date?: string | null
          service_type_codes?: string[]
          updated_at?: string
          version?: number
        }
        Update: {
          active?: boolean
          body_template?: string | null
          business_category_codes?: string[]
          code?: string
          created_at?: string
          effective_date?: string
          id?: string
          name?: string
          placeholder_fields?: string[]
          registration_group_codes?: string[]
          requirement_type?: string
          review_date?: string | null
          service_type_codes?: string[]
          updated_at?: string
          version?: number
        }
        Relationships: []
      }
      mealtime_profiles: {
        Row: {
          allergies: string | null
          choking_emergency_response: string | null
          created_at: string
          created_by: string | null
          fluid_consistency: string | null
          id: string
          identified_risks: string | null
          mealtime_support_required: boolean
          organisation_id: string
          participant_id: string
          plan_practitioner: string | null
          plan_review_date: string | null
          practitioner_plan_url: string | null
          record_status: Database["public"]["Enums"]["record_status"]
          required_competency_code: string
          seating_positioning: string | null
          status: string
          texture_modification: string | null
          updated_at: string
        }
        Insert: {
          allergies?: string | null
          choking_emergency_response?: string | null
          created_at?: string
          created_by?: string | null
          fluid_consistency?: string | null
          id?: string
          identified_risks?: string | null
          mealtime_support_required?: boolean
          organisation_id: string
          participant_id: string
          plan_practitioner?: string | null
          plan_review_date?: string | null
          practitioner_plan_url?: string | null
          record_status?: Database["public"]["Enums"]["record_status"]
          required_competency_code?: string
          seating_positioning?: string | null
          status?: string
          texture_modification?: string | null
          updated_at?: string
        }
        Update: {
          allergies?: string | null
          choking_emergency_response?: string | null
          created_at?: string
          created_by?: string | null
          fluid_consistency?: string | null
          id?: string
          identified_risks?: string | null
          mealtime_support_required?: boolean
          organisation_id?: string
          participant_id?: string
          plan_practitioner?: string | null
          plan_review_date?: string | null
          practitioner_plan_url?: string | null
          record_status?: Database["public"]["Enums"]["record_status"]
          required_competency_code?: string
          seating_positioning?: string | null
          status?: string
          texture_modification?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mealtime_profiles_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mealtime_profiles_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
        ]
      }
      mealtime_task_assignments: {
        Row: {
          blocked_reason: string | null
          competency_verified_at: string | null
          created_at: string
          created_by: string | null
          id: string
          mealtime_profile_id: string
          organisation_id: string
          participant_id: string
          status: string
          updated_at: string
          worker_id: string
        }
        Insert: {
          blocked_reason?: string | null
          competency_verified_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          mealtime_profile_id: string
          organisation_id: string
          participant_id: string
          status?: string
          updated_at?: string
          worker_id: string
        }
        Update: {
          blocked_reason?: string | null
          competency_verified_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          mealtime_profile_id?: string
          organisation_id?: string
          participant_id?: string
          status?: string
          updated_at?: string
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mealtime_task_assignments_mealtime_profile_id_fkey"
            columns: ["mealtime_profile_id"]
            isOneToOne: false
            referencedRelation: "mealtime_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mealtime_task_assignments_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mealtime_task_assignments_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
        ]
      }
      medication_administration_records: {
        Row: {
          created_at: string
          due_at: string
          escalated: boolean
          escalation_notes: string | null
          id: string
          linked_incident_id: string | null
          medication_profile_id: string
          organisation_id: string
          participant_id: string
          reason: string | null
          record_status: Database["public"]["Enums"]["record_status"]
          recorded_at: string | null
          result: Database["public"]["Enums"]["medication_admin_result"] | null
          updated_at: string
          witness_id: string | null
          worker_id: string | null
        }
        Insert: {
          created_at?: string
          due_at: string
          escalated?: boolean
          escalation_notes?: string | null
          id?: string
          linked_incident_id?: string | null
          medication_profile_id: string
          organisation_id: string
          participant_id: string
          reason?: string | null
          record_status?: Database["public"]["Enums"]["record_status"]
          recorded_at?: string | null
          result?: Database["public"]["Enums"]["medication_admin_result"] | null
          updated_at?: string
          witness_id?: string | null
          worker_id?: string | null
        }
        Update: {
          created_at?: string
          due_at?: string
          escalated?: boolean
          escalation_notes?: string | null
          id?: string
          linked_incident_id?: string | null
          medication_profile_id?: string
          organisation_id?: string
          participant_id?: string
          reason?: string | null
          record_status?: Database["public"]["Enums"]["record_status"]
          recorded_at?: string | null
          result?: Database["public"]["Enums"]["medication_admin_result"] | null
          updated_at?: string
          witness_id?: string | null
          worker_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "medication_administration_records_linked_incident_id_fkey"
            columns: ["linked_incident_id"]
            isOneToOne: false
            referencedRelation: "incidents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medication_administration_records_medication_profile_id_fkey"
            columns: ["medication_profile_id"]
            isOneToOne: false
            referencedRelation: "medication_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medication_administration_records_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medication_administration_records_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
        ]
      }
      medication_profiles: {
        Row: {
          authorised_record_url: string | null
          consent_date: string | null
          consent_obtained: boolean
          controlled_drug: boolean
          created_at: string
          created_by: string | null
          dose: string | null
          double_check_required: boolean
          end_date: string | null
          form: string | null
          id: string
          medication_name: string
          notes: string | null
          organisation_id: string
          participant_id: string
          pharmacy: string | null
          prescriber_contact: string | null
          prescriber_name: string | null
          record_status: Database["public"]["Enums"]["record_status"]
          review_date: string | null
          route: string | null
          start_date: string | null
          status: string
          storage_location: string | null
          timing: string | null
          updated_at: string
        }
        Insert: {
          authorised_record_url?: string | null
          consent_date?: string | null
          consent_obtained?: boolean
          controlled_drug?: boolean
          created_at?: string
          created_by?: string | null
          dose?: string | null
          double_check_required?: boolean
          end_date?: string | null
          form?: string | null
          id?: string
          medication_name: string
          notes?: string | null
          organisation_id: string
          participant_id: string
          pharmacy?: string | null
          prescriber_contact?: string | null
          prescriber_name?: string | null
          record_status?: Database["public"]["Enums"]["record_status"]
          review_date?: string | null
          route?: string | null
          start_date?: string | null
          status?: string
          storage_location?: string | null
          timing?: string | null
          updated_at?: string
        }
        Update: {
          authorised_record_url?: string | null
          consent_date?: string | null
          consent_obtained?: boolean
          controlled_drug?: boolean
          created_at?: string
          created_by?: string | null
          dose?: string | null
          double_check_required?: boolean
          end_date?: string | null
          form?: string | null
          id?: string
          medication_name?: string
          notes?: string | null
          organisation_id?: string
          participant_id?: string
          pharmacy?: string | null
          prescriber_contact?: string | null
          prescriber_name?: string | null
          record_status?: Database["public"]["Enums"]["record_status"]
          review_date?: string | null
          route?: string | null
          start_date?: string | null
          status?: string
          storage_location?: string | null
          timing?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "medication_profiles_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medication_profiles_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
        ]
      }
      medication_storage_checks: {
        Row: {
          checked_at: string
          checked_by: string | null
          created_at: string
          follow_up_action: string | null
          id: string
          issues: string | null
          location: string
          organisation_id: string
          secure_storage_ok: boolean
          stock_reconciled: boolean
          temperature_ok: boolean
          updated_at: string
        }
        Insert: {
          checked_at?: string
          checked_by?: string | null
          created_at?: string
          follow_up_action?: string | null
          id?: string
          issues?: string | null
          location: string
          organisation_id: string
          secure_storage_ok?: boolean
          stock_reconciled?: boolean
          temperature_ok?: boolean
          updated_at?: string
        }
        Update: {
          checked_at?: string
          checked_by?: string | null
          created_at?: string
          follow_up_action?: string | null
          id?: string
          issues?: string | null
          location?: string
          organisation_id?: string
          secure_storage_ok?: boolean
          stock_reconciled?: boolean
          temperature_ok?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "medication_storage_checks_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_audit_log: {
        Row: {
          created_at: string
          event_type: string
          id: string
          metadata: Json | null
          notification_id: string | null
          source_record_id: string | null
          source_table: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          metadata?: Json | null
          notification_id?: string | null
          source_record_id?: string | null
          source_table?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          metadata?: Json | null
          notification_id?: string | null
          source_record_id?: string | null
          source_table?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_audit_log_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "notifications"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          created_at: string
          critical_only: boolean
          digest_frequency: string
          email_enabled: boolean
          id: string
          in_app_enabled: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          critical_only?: boolean
          digest_frequency?: string
          email_enabled?: boolean
          id?: string
          in_app_enabled?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          critical_only?: boolean
          digest_frequency?: string
          email_enabled?: boolean
          id?: string
          in_app_enabled?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          created_by: string | null
          dedupe_bucket: string | null
          fingerprint: string | null
          id: string
          is_read: boolean
          link: string | null
          message: string | null
          metadata: Json | null
          notification_type: string
          organisation_id: string | null
          read_at: string | null
          severity: string
          source_record_id: string | null
          source_table: string | null
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          dedupe_bucket?: string | null
          fingerprint?: string | null
          id?: string
          is_read?: boolean
          link?: string | null
          message?: string | null
          metadata?: Json | null
          notification_type?: string
          organisation_id?: string | null
          read_at?: string | null
          severity?: string
          source_record_id?: string | null
          source_table?: string | null
          title: string
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          dedupe_bucket?: string | null
          fingerprint?: string | null
          id?: string
          is_read?: boolean
          link?: string | null
          message?: string | null
          metadata?: Json | null
          notification_type?: string
          organisation_id?: string | null
          read_at?: string | null
          severity?: string
          source_record_id?: string | null
          source_table?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_answers: {
        Row: {
          answered_by: string | null
          created_at: string
          id: string
          is_archived: boolean
          is_masked: boolean
          onboarding_id: string
          organisation_id: string
          requirement_key: string
          step_key: string
          updated_at: string
          value_bool: boolean | null
          value_date: string | null
          value_json: Json | null
          value_number: number | null
          value_text: string | null
        }
        Insert: {
          answered_by?: string | null
          created_at?: string
          id?: string
          is_archived?: boolean
          is_masked?: boolean
          onboarding_id: string
          organisation_id: string
          requirement_key: string
          step_key: string
          updated_at?: string
          value_bool?: boolean | null
          value_date?: string | null
          value_json?: Json | null
          value_number?: number | null
          value_text?: string | null
        }
        Update: {
          answered_by?: string | null
          created_at?: string
          id?: string
          is_archived?: boolean
          is_masked?: boolean
          onboarding_id?: string
          organisation_id?: string
          requirement_key?: string
          step_key?: string
          updated_at?: string
          value_bool?: boolean | null
          value_date?: string | null
          value_json?: Json | null
          value_number?: number | null
          value_text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_answers_onboarding_id_fkey"
            columns: ["onboarding_id"]
            isOneToOne: false
            referencedRelation: "organisation_onboarding"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "onboarding_answers_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_pathway_rules: {
        Row: {
          active: boolean
          business_category_id: string | null
          condition_json: Json | null
          created_at: string
          display_order: number
          field_type: string
          id: string
          label: string | null
          question_definition_id: string | null
          required: boolean
          requirement_key: string | null
          requires_document: boolean
          requires_expiry: boolean
          service_type_id: string | null
          step_key: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          business_category_id?: string | null
          condition_json?: Json | null
          created_at?: string
          display_order?: number
          field_type?: string
          id?: string
          label?: string | null
          question_definition_id?: string | null
          required?: boolean
          requirement_key?: string | null
          requires_document?: boolean
          requires_expiry?: boolean
          service_type_id?: string | null
          step_key?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          business_category_id?: string | null
          condition_json?: Json | null
          created_at?: string
          display_order?: number
          field_type?: string
          id?: string
          label?: string | null
          question_definition_id?: string | null
          required?: boolean
          requirement_key?: string | null
          requires_document?: boolean
          requires_expiry?: boolean
          service_type_id?: string | null
          step_key?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_pathway_rules_business_category_id_fkey"
            columns: ["business_category_id"]
            isOneToOne: false
            referencedRelation: "business_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "onboarding_pathway_rules_question_definition_id_fkey"
            columns: ["question_definition_id"]
            isOneToOne: false
            referencedRelation: "pathway_requirements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "onboarding_pathway_rules_service_type_id_fkey"
            columns: ["service_type_id"]
            isOneToOne: false
            referencedRelation: "service_types"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_review_findings: {
        Row: {
          created_at: string
          decision: string
          id: string
          onboarding_id: string
          organisation_id: string
          requirement_key: string
          reviewed_at: string | null
          reviewed_by: string | null
          reviewer_notes: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          decision?: string
          id?: string
          onboarding_id: string
          organisation_id: string
          requirement_key: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          reviewer_notes?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          decision?: string
          id?: string
          onboarding_id?: string
          organisation_id?: string
          requirement_key?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          reviewer_notes?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_review_findings_onboarding_id_fkey"
            columns: ["onboarding_id"]
            isOneToOne: false
            referencedRelation: "organisation_onboarding"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "onboarding_review_findings_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      organisation_documents: {
        Row: {
          created_at: string
          document_type: string
          expiry_date: string | null
          file_name: string | null
          id: string
          is_critical: boolean
          issue_date: string | null
          mime_type: string | null
          organisation_id: string
          requirement_key: string | null
          sensitivity: Database["public"]["Enums"]["sensitivity_level"]
          storage_path: string
          supersedes_id: string | null
          title: string
          updated_at: string
          uploaded_by: string | null
          verification_notes: string | null
          verification_status: string
          verified_at: string | null
          verified_by: string | null
          version: number
        }
        Insert: {
          created_at?: string
          document_type: string
          expiry_date?: string | null
          file_name?: string | null
          id?: string
          is_critical?: boolean
          issue_date?: string | null
          mime_type?: string | null
          organisation_id: string
          requirement_key?: string | null
          sensitivity?: Database["public"]["Enums"]["sensitivity_level"]
          storage_path: string
          supersedes_id?: string | null
          title: string
          updated_at?: string
          uploaded_by?: string | null
          verification_notes?: string | null
          verification_status?: string
          verified_at?: string | null
          verified_by?: string | null
          version?: number
        }
        Update: {
          created_at?: string
          document_type?: string
          expiry_date?: string | null
          file_name?: string | null
          id?: string
          is_critical?: boolean
          issue_date?: string | null
          mime_type?: string | null
          organisation_id?: string
          requirement_key?: string | null
          sensitivity?: Database["public"]["Enums"]["sensitivity_level"]
          storage_path?: string
          supersedes_id?: string | null
          title?: string
          updated_at?: string
          uploaded_by?: string | null
          verification_notes?: string | null
          verification_status?: string
          verified_at?: string | null
          verified_by?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "organisation_documents_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organisation_documents_supersedes_id_fkey"
            columns: ["supersedes_id"]
            isOneToOne: false
            referencedRelation: "organisation_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      organisation_invitations: {
        Row: {
          accepted_at: string | null
          accepted_user_id: string | null
          created_at: string
          email: string
          expires_at: string
          failure_reason: string | null
          full_name: string | null
          id: string
          invited_by: string | null
          last_sent_at: string
          organisation_id: string
          role: Database["public"]["Enums"]["app_role"]
          send_attempts: number
          status: string
          token_hash: string | null
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_user_id?: string | null
          created_at?: string
          email: string
          expires_at?: string
          failure_reason?: string | null
          full_name?: string | null
          id?: string
          invited_by?: string | null
          last_sent_at?: string
          organisation_id: string
          role?: Database["public"]["Enums"]["app_role"]
          send_attempts?: number
          status?: string
          token_hash?: string | null
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_user_id?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          failure_reason?: string | null
          full_name?: string | null
          id?: string
          invited_by?: string | null
          last_sent_at?: string
          organisation_id?: string
          role?: Database["public"]["Enums"]["app_role"]
          send_attempts?: number
          status?: string
          token_hash?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organisation_invitations_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      organisation_module_entitlements: {
        Row: {
          activated_at: string | null
          created_at: string
          id: string
          is_enabled: boolean
          module_key: string
          organisation_id: string
          source: string
          updated_at: string
        }
        Insert: {
          activated_at?: string | null
          created_at?: string
          id?: string
          is_enabled?: boolean
          module_key: string
          organisation_id: string
          source?: string
          updated_at?: string
        }
        Update: {
          activated_at?: string | null
          created_at?: string
          id?: string
          is_enabled?: boolean
          module_key?: string
          organisation_id?: string
          source?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organisation_module_entitlements_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      organisation_onboarding: {
        Row: {
          approved_at: string | null
          completed_steps: string[]
          created_at: string
          current_step: string
          id: string
          ndis_funding_status: string | null
          organisation_id: string
          pathway_id: string | null
          pathway_status: string
          progress_pct: number
          returned_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          services_confirmed_at: string | null
          status: string
          submitted_at: string | null
          submitted_by: string | null
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          completed_steps?: string[]
          created_at?: string
          current_step?: string
          id?: string
          ndis_funding_status?: string | null
          organisation_id: string
          pathway_id?: string | null
          pathway_status?: string
          progress_pct?: number
          returned_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          services_confirmed_at?: string | null
          status?: string
          submitted_at?: string | null
          submitted_by?: string | null
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          completed_steps?: string[]
          created_at?: string
          current_step?: string
          id?: string
          ndis_funding_status?: string | null
          organisation_id?: string
          pathway_id?: string | null
          pathway_status?: string
          progress_pct?: number
          returned_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          services_confirmed_at?: string | null
          status?: string
          submitted_at?: string | null
          submitted_by?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organisation_onboarding_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: true
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organisation_onboarding_pathway_id_fkey"
            columns: ["pathway_id"]
            isOneToOne: false
            referencedRelation: "provider_pathways"
            referencedColumns: ["id"]
          },
        ]
      }
      organisation_service_selections: {
        Row: {
          business_category_id: string
          commencement_date: string | null
          confirmed_at: string | null
          confirmed_by: string | null
          created_at: string
          delivery_status: string
          id: string
          is_archived: boolean
          ndis_funded: boolean
          organisation_id: string
          registered_service: boolean
          review_date: string | null
          service_type_id: string | null
          updated_at: string
        }
        Insert: {
          business_category_id: string
          commencement_date?: string | null
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          delivery_status?: string
          id?: string
          is_archived?: boolean
          ndis_funded?: boolean
          organisation_id: string
          registered_service?: boolean
          review_date?: string | null
          service_type_id?: string | null
          updated_at?: string
        }
        Update: {
          business_category_id?: string
          commencement_date?: string | null
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          delivery_status?: string
          id?: string
          is_archived?: boolean
          ndis_funded?: boolean
          organisation_id?: string
          registered_service?: boolean
          review_date?: string | null
          service_type_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organisation_service_selections_business_category_id_fkey"
            columns: ["business_category_id"]
            isOneToOne: false
            referencedRelation: "business_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organisation_service_selections_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organisation_service_selections_service_type_id_fkey"
            columns: ["service_type_id"]
            isOneToOne: false
            referencedRelation: "service_types"
            referencedColumns: ["id"]
          },
        ]
      }
      organisations: {
        Row: {
          abn: string | null
          account_status: string
          acn: string | null
          activated_at: string | null
          address_line1: string | null
          created_at: string
          created_by: string | null
          id: string
          is_demo: boolean
          last_activity_at: string | null
          legal_name: string | null
          name: string
          ndis_registration: string | null
          pathway_id: string | null
          postcode: string | null
          primary_contact_email: string | null
          primary_contact_name: string | null
          primary_contact_phone: string | null
          state: string | null
          suburb: string | null
          suspended_reason: string | null
          trading_name: string | null
          updated_at: string
        }
        Insert: {
          abn?: string | null
          account_status?: string
          acn?: string | null
          activated_at?: string | null
          address_line1?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_demo?: boolean
          last_activity_at?: string | null
          legal_name?: string | null
          name: string
          ndis_registration?: string | null
          pathway_id?: string | null
          postcode?: string | null
          primary_contact_email?: string | null
          primary_contact_name?: string | null
          primary_contact_phone?: string | null
          state?: string | null
          suburb?: string | null
          suspended_reason?: string | null
          trading_name?: string | null
          updated_at?: string
        }
        Update: {
          abn?: string | null
          account_status?: string
          acn?: string | null
          activated_at?: string | null
          address_line1?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_demo?: boolean
          last_activity_at?: string | null
          legal_name?: string | null
          name?: string
          ndis_registration?: string | null
          pathway_id?: string | null
          postcode?: string | null
          primary_contact_email?: string | null
          primary_contact_name?: string | null
          primary_contact_phone?: string | null
          state?: string | null
          suburb?: string | null
          suspended_reason?: string | null
          trading_name?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organisations_pathway_fk"
            columns: ["pathway_id"]
            isOneToOne: false
            referencedRelation: "provider_pathways"
            referencedColumns: ["id"]
          },
        ]
      }
      participant_concerns: {
        Row: {
          advocacy_referral: boolean
          anonymous: boolean
          concern: string
          created_at: string
          id: string
          no_retaliation_acknowledged: boolean
          organisation_id: string
          outcome: string | null
          participant_id: string | null
          raised_by: string | null
          record_status: Database["public"]["Enums"]["record_status"]
          routed_to_complaint_id: string | null
          status: string
          support_requested: string | null
          updated_at: string
        }
        Insert: {
          advocacy_referral?: boolean
          anonymous?: boolean
          concern: string
          created_at?: string
          id?: string
          no_retaliation_acknowledged?: boolean
          organisation_id: string
          outcome?: string | null
          participant_id?: string | null
          raised_by?: string | null
          record_status?: Database["public"]["Enums"]["record_status"]
          routed_to_complaint_id?: string | null
          status?: string
          support_requested?: string | null
          updated_at?: string
        }
        Update: {
          advocacy_referral?: boolean
          anonymous?: boolean
          concern?: string
          created_at?: string
          id?: string
          no_retaliation_acknowledged?: boolean
          organisation_id?: string
          outcome?: string | null
          participant_id?: string | null
          raised_by?: string | null
          record_status?: Database["public"]["Enums"]["record_status"]
          routed_to_complaint_id?: string | null
          status?: string
          support_requested?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "participant_concerns_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "participant_concerns_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "participant_concerns_routed_to_complaint_id_fkey"
            columns: ["routed_to_complaint_id"]
            isOneToOne: false
            referencedRelation: "complaints"
            referencedColumns: ["id"]
          },
        ]
      }
      participant_consents: {
        Row: {
          accessible_format: string | null
          advocate_contact: string | null
          advocate_name: string | null
          captured_by: string | null
          communication_preference: string | null
          consent_date: string | null
          consent_status: Database["public"]["Enums"]["consent_status"]
          consent_version: number
          created_at: string
          id: string
          information_sharing_parties: Json
          interpreter_required: boolean
          nominee_contact: string | null
          nominee_name: string | null
          nominee_relationship: string | null
          notes: string | null
          organisation_id: string
          participant_id: string
          purpose_collection: string | null
          purpose_disclosure: string | null
          purpose_use: string | null
          record_status: Database["public"]["Enums"]["record_status"]
          updated_at: string
          withdrawn_date: string | null
        }
        Insert: {
          accessible_format?: string | null
          advocate_contact?: string | null
          advocate_name?: string | null
          captured_by?: string | null
          communication_preference?: string | null
          consent_date?: string | null
          consent_status?: Database["public"]["Enums"]["consent_status"]
          consent_version?: number
          created_at?: string
          id?: string
          information_sharing_parties?: Json
          interpreter_required?: boolean
          nominee_contact?: string | null
          nominee_name?: string | null
          nominee_relationship?: string | null
          notes?: string | null
          organisation_id: string
          participant_id: string
          purpose_collection?: string | null
          purpose_disclosure?: string | null
          purpose_use?: string | null
          record_status?: Database["public"]["Enums"]["record_status"]
          updated_at?: string
          withdrawn_date?: string | null
        }
        Update: {
          accessible_format?: string | null
          advocate_contact?: string | null
          advocate_name?: string | null
          captured_by?: string | null
          communication_preference?: string | null
          consent_date?: string | null
          consent_status?: Database["public"]["Enums"]["consent_status"]
          consent_version?: number
          created_at?: string
          id?: string
          information_sharing_parties?: Json
          interpreter_required?: boolean
          nominee_contact?: string | null
          nominee_name?: string | null
          nominee_relationship?: string | null
          notes?: string | null
          organisation_id?: string
          participant_id?: string
          purpose_collection?: string | null
          purpose_disclosure?: string | null
          purpose_use?: string | null
          record_status?: Database["public"]["Enums"]["record_status"]
          updated_at?: string
          withdrawn_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "participant_consents_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "participant_consents_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
        ]
      }
      participant_continuity_plans: {
        Row: {
          alternative_provider: string | null
          alternative_worker_id: string | null
          communication_requirements: string | null
          created_at: string
          created_by: string | null
          critical_supports: string
          emergency_contacts: Json
          evacuation_requirements: string | null
          id: string
          last_tested_date: string | null
          organisation_id: string
          participant_id: string
          record_status: Database["public"]["Enums"]["record_status"]
          review_date: string | null
          test_notes: string | null
          updated_at: string
        }
        Insert: {
          alternative_provider?: string | null
          alternative_worker_id?: string | null
          communication_requirements?: string | null
          created_at?: string
          created_by?: string | null
          critical_supports: string
          emergency_contacts?: Json
          evacuation_requirements?: string | null
          id?: string
          last_tested_date?: string | null
          organisation_id: string
          participant_id: string
          record_status?: Database["public"]["Enums"]["record_status"]
          review_date?: string | null
          test_notes?: string | null
          updated_at?: string
        }
        Update: {
          alternative_provider?: string | null
          alternative_worker_id?: string | null
          communication_requirements?: string | null
          created_at?: string
          created_by?: string | null
          critical_supports?: string
          emergency_contacts?: Json
          evacuation_requirements?: string | null
          id?: string
          last_tested_date?: string | null
          organisation_id?: string
          participant_id?: string
          record_status?: Database["public"]["Enums"]["record_status"]
          review_date?: string | null
          test_notes?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "participant_continuity_plans_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "participant_continuity_plans_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
        ]
      }
      participant_evidence_preferences: {
        Row: {
          accessible_explanation_provided: boolean
          alternative_evidence_method: string | null
          consent_date: string | null
          consent_id: string | null
          consent_version: number | null
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          organisation_id: string
          participant_id: string
          participant_may_appear: boolean
          photography_consent_status: Database["public"]["Enums"]["consent_status"]
          photography_restrictions: string | null
          private_area_restrictions: string | null
          record_status: Database["public"]["Enums"]["record_status"]
          review_date: string | null
          reviewed_by: string | null
          updated_at: string
        }
        Insert: {
          accessible_explanation_provided?: boolean
          alternative_evidence_method?: string | null
          consent_date?: string | null
          consent_id?: string | null
          consent_version?: number | null
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          organisation_id: string
          participant_id: string
          participant_may_appear?: boolean
          photography_consent_status?: Database["public"]["Enums"]["consent_status"]
          photography_restrictions?: string | null
          private_area_restrictions?: string | null
          record_status?: Database["public"]["Enums"]["record_status"]
          review_date?: string | null
          reviewed_by?: string | null
          updated_at?: string
        }
        Update: {
          accessible_explanation_provided?: boolean
          alternative_evidence_method?: string | null
          consent_date?: string | null
          consent_id?: string | null
          consent_version?: number | null
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          organisation_id?: string
          participant_id?: string
          participant_may_appear?: boolean
          photography_consent_status?: Database["public"]["Enums"]["consent_status"]
          photography_restrictions?: string | null
          private_area_restrictions?: string | null
          record_status?: Database["public"]["Enums"]["record_status"]
          review_date?: string | null
          reviewed_by?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "participant_evidence_preferences_consent_id_fkey"
            columns: ["consent_id"]
            isOneToOne: false
            referencedRelation: "participant_consents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "participant_evidence_preferences_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: true
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
        ]
      }
      participant_goals: {
        Row: {
          baseline_score: number | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          linked_training_module_id: string | null
          measurement_unit: string | null
          participant_id: string
          status: string
          target_date: string | null
          target_score: number | null
          title: string
          updated_at: string
        }
        Insert: {
          baseline_score?: number | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          linked_training_module_id?: string | null
          measurement_unit?: string | null
          participant_id: string
          status?: string
          target_date?: string | null
          target_score?: number | null
          title: string
          updated_at?: string
        }
        Update: {
          baseline_score?: number | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          linked_training_module_id?: string | null
          measurement_unit?: string | null
          participant_id?: string
          status?: string
          target_date?: string | null
          target_score?: number | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "participant_goals_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
        ]
      }
      participant_progress: {
        Row: {
          created_at: string
          evidence_file_url: string | null
          evidence_notes: string | null
          evidence_type: string | null
          goal_id: string | null
          id: string
          metric_name: string
          metric_value: number | null
          notes: string | null
          participant_id: string
          recorded_by: string | null
        }
        Insert: {
          created_at?: string
          evidence_file_url?: string | null
          evidence_notes?: string | null
          evidence_type?: string | null
          goal_id?: string | null
          id?: string
          metric_name: string
          metric_value?: number | null
          notes?: string | null
          participant_id: string
          recorded_by?: string | null
        }
        Update: {
          created_at?: string
          evidence_file_url?: string | null
          evidence_notes?: string | null
          evidence_type?: string | null
          goal_id?: string | null
          id?: string
          metric_name?: string
          metric_value?: number | null
          notes?: string | null
          participant_id?: string
          recorded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "participant_progress_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "participant_goals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "participant_progress_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
        ]
      }
      participant_risk_assessments: {
        Row: {
          consequence_score: number
          created_at: string
          created_by: string | null
          escalation_pathway: string | null
          existing_controls: string | null
          id: string
          likelihood_score: number
          organisation_id: string
          participant_id: string
          person_consulted: string | null
          record_status: Database["public"]["Enums"]["record_status"]
          review_date: string | null
          risk_description: string
          risk_level: string | null
          risk_score: number | null
          status: string
          support_plan_id: string | null
          updated_at: string
        }
        Insert: {
          consequence_score?: number
          created_at?: string
          created_by?: string | null
          escalation_pathway?: string | null
          existing_controls?: string | null
          id?: string
          likelihood_score?: number
          organisation_id: string
          participant_id: string
          person_consulted?: string | null
          record_status?: Database["public"]["Enums"]["record_status"]
          review_date?: string | null
          risk_description: string
          risk_level?: string | null
          risk_score?: number | null
          status?: string
          support_plan_id?: string | null
          updated_at?: string
        }
        Update: {
          consequence_score?: number
          created_at?: string
          created_by?: string | null
          escalation_pathway?: string | null
          existing_controls?: string | null
          id?: string
          likelihood_score?: number
          organisation_id?: string
          participant_id?: string
          person_consulted?: string | null
          record_status?: Database["public"]["Enums"]["record_status"]
          review_date?: string | null
          risk_description?: string
          risk_level?: string | null
          risk_score?: number | null
          status?: string
          support_plan_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "participant_risk_assessments_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "participant_risk_assessments_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "participant_risk_assessments_support_plan_id_fkey"
            columns: ["support_plan_id"]
            isOneToOne: false
            referencedRelation: "support_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      participant_risk_scores: {
        Row: {
          calculated_at: string
          distress_signals: number
          id: string
          incident_count: number
          missed_sessions: number
          participant_id: string
          score: number
          trend: string | null
        }
        Insert: {
          calculated_at?: string
          distress_signals?: number
          id?: string
          incident_count?: number
          missed_sessions?: number
          participant_id: string
          score?: number
          trend?: string | null
        }
        Update: {
          calculated_at?: string
          distress_signals?: number
          id?: string
          incident_count?: number
          missed_sessions?: number
          participant_id?: string
          score?: number
          trend?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "participant_risk_scores_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
        ]
      }
      participant_service_locations: {
        Row: {
          access_instructions: string | null
          access_instructions_restricted: boolean
          address_label: string | null
          created_at: string
          created_by: string | null
          geofence_radius_metres: number
          id: string
          is_active: boolean
          label: string
          latitude: number | null
          longitude: number | null
          organisation_id: string
          participant_id: string
          record_status: Database["public"]["Enums"]["record_status"]
          suburb: string | null
          updated_at: string
        }
        Insert: {
          access_instructions?: string | null
          access_instructions_restricted?: boolean
          address_label?: string | null
          created_at?: string
          created_by?: string | null
          geofence_radius_metres?: number
          id?: string
          is_active?: boolean
          label: string
          latitude?: number | null
          longitude?: number | null
          organisation_id: string
          participant_id: string
          record_status?: Database["public"]["Enums"]["record_status"]
          suburb?: string | null
          updated_at?: string
        }
        Update: {
          access_instructions?: string | null
          access_instructions_restricted?: boolean
          address_label?: string | null
          created_at?: string
          created_by?: string | null
          geofence_radius_metres?: number
          id?: string
          is_active?: boolean
          label?: string
          latitude?: number | null
          longitude?: number | null
          organisation_id?: string
          participant_id?: string
          record_status?: Database["public"]["Enums"]["record_status"]
          suburb?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "participant_service_locations_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
        ]
      }
      participants: {
        Row: {
          address: string | null
          assigned_trainer_id: string | null
          communication_method: string | null
          consent_date: string | null
          consent_status: Database["public"]["Enums"]["consent_status"]
          created_at: string
          created_by: string | null
          cultural_preferences: string | null
          date_of_birth: string | null
          email: string | null
          emergency_contact: Json | null
          first_name: string
          funding_management_type: string | null
          government_id: string | null
          id: string
          last_name: string
          ndis_number: string | null
          organisation_id: string
          participant_number: string | null
          phone: string | null
          plan_end_date: string | null
          plan_manager: string | null
          plan_start_date: string | null
          preferred_name: string | null
          record_status: Database["public"]["Enums"]["record_status"]
          risk_flags: string[] | null
          sensitivity_level: Database["public"]["Enums"]["sensitivity_level"]
          status: string
          support_coordinator: string | null
          support_type: string | null
          team_id: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          address?: string | null
          assigned_trainer_id?: string | null
          communication_method?: string | null
          consent_date?: string | null
          consent_status?: Database["public"]["Enums"]["consent_status"]
          created_at?: string
          created_by?: string | null
          cultural_preferences?: string | null
          date_of_birth?: string | null
          email?: string | null
          emergency_contact?: Json | null
          first_name: string
          funding_management_type?: string | null
          government_id?: string | null
          id?: string
          last_name: string
          ndis_number?: string | null
          organisation_id: string
          participant_number?: string | null
          phone?: string | null
          plan_end_date?: string | null
          plan_manager?: string | null
          plan_start_date?: string | null
          preferred_name?: string | null
          record_status?: Database["public"]["Enums"]["record_status"]
          risk_flags?: string[] | null
          sensitivity_level?: Database["public"]["Enums"]["sensitivity_level"]
          status?: string
          support_coordinator?: string | null
          support_type?: string | null
          team_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          address?: string | null
          assigned_trainer_id?: string | null
          communication_method?: string | null
          consent_date?: string | null
          consent_status?: Database["public"]["Enums"]["consent_status"]
          created_at?: string
          created_by?: string | null
          cultural_preferences?: string | null
          date_of_birth?: string | null
          email?: string | null
          emergency_contact?: Json | null
          first_name?: string
          funding_management_type?: string | null
          government_id?: string | null
          id?: string
          last_name?: string
          ndis_number?: string | null
          organisation_id?: string
          participant_number?: string | null
          phone?: string | null
          plan_end_date?: string | null
          plan_manager?: string | null
          plan_start_date?: string | null
          preferred_name?: string | null
          record_status?: Database["public"]["Enums"]["record_status"]
          risk_flags?: string[] | null
          sensitivity_level?: Database["public"]["Enums"]["sensitivity_level"]
          status?: string
          support_coordinator?: string | null
          support_type?: string | null
          team_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "participants_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "participants_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      pathway_requirements: {
        Row: {
          conditional_on: Json | null
          created_at: string
          field_type: string
          help_text: string | null
          id: string
          is_active: boolean
          is_mandatory: boolean
          label: string
          options: Json
          pathway_id: string
          requirement_key: string
          requires_document: boolean
          requires_expiry: boolean
          sensitivity: Database["public"]["Enums"]["sensitivity_level"]
          sort_order: number
          step_key: string
          updated_at: string
        }
        Insert: {
          conditional_on?: Json | null
          created_at?: string
          field_type?: string
          help_text?: string | null
          id?: string
          is_active?: boolean
          is_mandatory?: boolean
          label: string
          options?: Json
          pathway_id: string
          requirement_key: string
          requires_document?: boolean
          requires_expiry?: boolean
          sensitivity?: Database["public"]["Enums"]["sensitivity_level"]
          sort_order?: number
          step_key: string
          updated_at?: string
        }
        Update: {
          conditional_on?: Json | null
          created_at?: string
          field_type?: string
          help_text?: string | null
          id?: string
          is_active?: boolean
          is_mandatory?: boolean
          label?: string
          options?: Json
          pathway_id?: string
          requirement_key?: string
          requires_document?: boolean
          requires_expiry?: boolean
          sensitivity?: Database["public"]["Enums"]["sensitivity_level"]
          sort_order?: number
          step_key?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pathway_requirements_pathway_id_fkey"
            columns: ["pathway_id"]
            isOneToOne: false
            referencedRelation: "provider_pathways"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_activity_events: {
        Row: {
          actor_label: string | null
          actor_user_id: string | null
          created_at: string
          event_type: string
          id: string
          metadata: Json
          organisation_id: string | null
          summary: string
        }
        Insert: {
          actor_label?: string | null
          actor_user_id?: string | null
          created_at?: string
          event_type: string
          id?: string
          metadata?: Json
          organisation_id?: string | null
          summary: string
        }
        Update: {
          actor_label?: string | null
          actor_user_id?: string | null
          created_at?: string
          event_type?: string
          id?: string
          metadata?: Json
          organisation_id?: string | null
          summary?: string
        }
        Relationships: [
          {
            foreignKeyName: "platform_activity_events_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_income_records: {
        Row: {
          amount: number
          created_at: string
          currency: string
          id: string
          issued_date: string
          notes: string | null
          organisation_id: string | null
          received_date: string | null
          record_type: string
          recorded_by: string | null
          reference: string | null
          status: string
          subscription_id: string | null
          updated_at: string
        }
        Insert: {
          amount?: number
          created_at?: string
          currency?: string
          id?: string
          issued_date?: string
          notes?: string | null
          organisation_id?: string | null
          received_date?: string | null
          record_type?: string
          recorded_by?: string | null
          reference?: string | null
          status?: string
          subscription_id?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          id?: string
          issued_date?: string
          notes?: string | null
          organisation_id?: string | null
          received_date?: string | null
          record_type?: string
          recorded_by?: string | null
          reference?: string | null
          status?: string
          subscription_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "platform_income_records_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "platform_income_records_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "tenant_subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_support_sessions: {
        Row: {
          created_at: string
          ended_at: string | null
          expires_at: string
          id: string
          organisation_id: string
          reason: string
          requested_by: string
          scope: string
          started_at: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          ended_at?: string | null
          expires_at: string
          id?: string
          organisation_id: string
          reason: string
          requested_by: string
          scope?: string
          started_at?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          ended_at?: string | null
          expires_at?: string
          id?: string
          organisation_id?: string
          reason?: string
          requested_by?: string
          scope?: string
          started_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "platform_support_sessions_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      policies: {
        Row: {
          acknowledgement_due_date: string | null
          approved_at: string | null
          approved_by: string | null
          category: string | null
          created_at: string
          current_version: number
          effective_date: string | null
          id: string
          last_review_date: string | null
          linked_standard_id: string | null
          linked_training_module_id: string | null
          master_template_id: string | null
          master_template_version: number | null
          next_review_date: string | null
          organisation_id: string
          owner_id: string | null
          policy_text: string | null
          published_at: string | null
          record_status: Database["public"]["Enums"]["record_status"]
          staff_acknowledgement_required: boolean | null
          status: Database["public"]["Enums"]["policy_status"]
          title: string
          updated_at: string
        }
        Insert: {
          acknowledgement_due_date?: string | null
          approved_at?: string | null
          approved_by?: string | null
          category?: string | null
          created_at?: string
          current_version?: number
          effective_date?: string | null
          id?: string
          last_review_date?: string | null
          linked_standard_id?: string | null
          linked_training_module_id?: string | null
          master_template_id?: string | null
          master_template_version?: number | null
          next_review_date?: string | null
          organisation_id: string
          owner_id?: string | null
          policy_text?: string | null
          published_at?: string | null
          record_status?: Database["public"]["Enums"]["record_status"]
          staff_acknowledgement_required?: boolean | null
          status?: Database["public"]["Enums"]["policy_status"]
          title: string
          updated_at?: string
        }
        Update: {
          acknowledgement_due_date?: string | null
          approved_at?: string | null
          approved_by?: string | null
          category?: string | null
          created_at?: string
          current_version?: number
          effective_date?: string | null
          id?: string
          last_review_date?: string | null
          linked_standard_id?: string | null
          linked_training_module_id?: string | null
          master_template_id?: string | null
          master_template_version?: number | null
          next_review_date?: string | null
          organisation_id?: string
          owner_id?: string | null
          policy_text?: string | null
          published_at?: string | null
          record_status?: Database["public"]["Enums"]["record_status"]
          staff_acknowledgement_required?: boolean | null
          status?: Database["public"]["Enums"]["policy_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "policies_linked_standard_id_fkey"
            columns: ["linked_standard_id"]
            isOneToOne: false
            referencedRelation: "practice_standards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "policies_linked_training_module_id_fkey"
            columns: ["linked_training_module_id"]
            isOneToOne: false
            referencedRelation: "training_modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "policies_master_template_id_fkey"
            columns: ["master_template_id"]
            isOneToOne: false
            referencedRelation: "master_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "policies_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      policy_acknowledgements: {
        Row: {
          acknowledged_at: string | null
          created_at: string
          due_date: string | null
          id: string
          policy_id: string
          user_id: string
        }
        Insert: {
          acknowledged_at?: string | null
          created_at?: string
          due_date?: string | null
          id?: string
          policy_id: string
          user_id: string
        }
        Update: {
          acknowledged_at?: string | null
          created_at?: string
          due_date?: string | null
          id?: string
          policy_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "policy_acknowledgements_policy_id_fkey"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "policies"
            referencedColumns: ["id"]
          },
        ]
      }
      policy_versions: {
        Row: {
          change_summary: string | null
          content: string | null
          created_at: string
          created_by: string
          id: string
          policy_id: string
          version_number: number
        }
        Insert: {
          change_summary?: string | null
          content?: string | null
          created_at?: string
          created_by: string
          id?: string
          policy_id: string
          version_number: number
        }
        Update: {
          change_summary?: string | null
          content?: string | null
          created_at?: string
          created_by?: string
          id?: string
          policy_id?: string
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "policy_versions_policy_id_fkey"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "policies"
            referencedColumns: ["id"]
          },
        ]
      }
      practice_outcomes: {
        Row: {
          created_at: string
          description: string | null
          id: string
          module_code: string
          outcome_code: string
          outcome_name: string
          part_name: string | null
          registration_groups: Json
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          module_code: string
          outcome_code: string
          outcome_name: string
          part_name?: string | null
          registration_groups?: Json
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          module_code?: string
          outcome_code?: string
          outcome_name?: string
          part_name?: string | null
          registration_groups?: Json
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "practice_outcomes_module_code_fkey"
            columns: ["module_code"]
            isOneToOne: false
            referencedRelation: "standard_modules"
            referencedColumns: ["code"]
          },
        ]
      }
      practice_standards: {
        Row: {
          category: string
          code: string
          created_at: string
          description: string | null
          id: string
          module_code: string | null
          name: string
          outcome_reference: string | null
        }
        Insert: {
          category: string
          code: string
          created_at?: string
          description?: string | null
          id?: string
          module_code?: string | null
          name: string
          outcome_reference?: string | null
        }
        Update: {
          category?: string
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          module_code?: string | null
          name?: string
          outcome_reference?: string | null
        }
        Relationships: []
      }
      privacy_incidents: {
        Row: {
          access_source: string | null
          affected_participants: Json | null
          affected_records_count: number | null
          affected_staff: Json | null
          breach_description: string | null
          containment_action: string | null
          corrective_action: string | null
          created_at: string
          data_type_involved: string[] | null
          date_detected: string
          detected_by: string
          geolocation_flag: string | null
          id: string
          incident_type: Database["public"]["Enums"]["privacy_incident_type"]
          notification_completed_date: string | null
          notification_required: boolean | null
          organisation_id: string
          record_status: Database["public"]["Enums"]["record_status"]
          risk_rating: string | null
          sensitivity_level: Database["public"]["Enums"]["sensitivity_level"]
          status: Database["public"]["Enums"]["privacy_incident_status"]
          team_id: string | null
          updated_at: string
        }
        Insert: {
          access_source?: string | null
          affected_participants?: Json | null
          affected_records_count?: number | null
          affected_staff?: Json | null
          breach_description?: string | null
          containment_action?: string | null
          corrective_action?: string | null
          created_at?: string
          data_type_involved?: string[] | null
          date_detected?: string
          detected_by: string
          geolocation_flag?: string | null
          id?: string
          incident_type?: Database["public"]["Enums"]["privacy_incident_type"]
          notification_completed_date?: string | null
          notification_required?: boolean | null
          organisation_id: string
          record_status?: Database["public"]["Enums"]["record_status"]
          risk_rating?: string | null
          sensitivity_level?: Database["public"]["Enums"]["sensitivity_level"]
          status?: Database["public"]["Enums"]["privacy_incident_status"]
          team_id?: string | null
          updated_at?: string
        }
        Update: {
          access_source?: string | null
          affected_participants?: Json | null
          affected_records_count?: number | null
          affected_staff?: Json | null
          breach_description?: string | null
          containment_action?: string | null
          corrective_action?: string | null
          created_at?: string
          data_type_involved?: string[] | null
          date_detected?: string
          detected_by?: string
          geolocation_flag?: string | null
          id?: string
          incident_type?: Database["public"]["Enums"]["privacy_incident_type"]
          notification_completed_date?: string | null
          notification_required?: boolean | null
          organisation_id?: string
          record_status?: Database["public"]["Enums"]["record_status"]
          risk_rating?: string | null
          sensitivity_level?: Database["public"]["Enums"]["sensitivity_level"]
          status?: Database["public"]["Enums"]["privacy_incident_status"]
          team_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "privacy_incidents_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "privacy_incidents_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      provider_pathways: {
        Row: {
          code: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      registration_groups: {
        Row: {
          code: string
          confirmed_at: string | null
          confirmed_by: string | null
          created_at: string
          delivery_status: string
          id: string
          is_confirmed: boolean
          name: string
          next_review_date: string | null
          notes: string | null
          organisation_id: string
          record_status: Database["public"]["Enums"]["record_status"]
          updated_at: string
        }
        Insert: {
          code: string
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          delivery_status?: string
          id?: string
          is_confirmed?: boolean
          name: string
          next_review_date?: string | null
          notes?: string | null
          organisation_id: string
          record_status?: Database["public"]["Enums"]["record_status"]
          updated_at?: string
        }
        Update: {
          code?: string
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          delivery_status?: string
          id?: string
          is_confirmed?: boolean
          name?: string
          next_review_date?: string | null
          notes?: string | null
          organisation_id?: string
          record_status?: Database["public"]["Enums"]["record_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "registration_groups_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      reportable_incident_assessments: {
        Row: {
          assessed_at: string
          assessed_by: string
          checklist: Json
          created_at: string
          decision: string
          decision_rationale: string
          due_at: string | null
          evidence: string | null
          id: string
          incident_id: string
          notification_reference: string | null
          notified_at: string | null
          organisation_id: string
          updated_at: string
        }
        Insert: {
          assessed_at?: string
          assessed_by: string
          checklist?: Json
          created_at?: string
          decision: string
          decision_rationale: string
          due_at?: string | null
          evidence?: string | null
          id?: string
          incident_id: string
          notification_reference?: string | null
          notified_at?: string | null
          organisation_id: string
          updated_at?: string
        }
        Update: {
          assessed_at?: string
          assessed_by?: string
          checklist?: Json
          created_at?: string
          decision?: string
          decision_rationale?: string
          due_at?: string | null
          evidence?: string | null
          id?: string
          incident_id?: string
          notification_reference?: string | null
          notified_at?: string | null
          organisation_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reportable_incident_assessments_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "incidents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reportable_incident_assessments_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      restrictive_practices: {
        Row: {
          authorisation_expiry: string | null
          authorisation_reference: string | null
          authorised_at: string | null
          authorised_by: string | null
          behaviour_support_plan_url: string | null
          behaviour_support_practitioner: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_authorised: boolean
          least_restrictive_review: string | null
          linked_incident_id: string | null
          organisation_id: string
          participant_id: string
          practice_type: string
          record_status: Database["public"]["Enums"]["record_status"]
          reduction_plan: string | null
          reporting_actions: string | null
          review_date: string | null
          status: string
          updated_at: string
        }
        Insert: {
          authorisation_expiry?: string | null
          authorisation_reference?: string | null
          authorised_at?: string | null
          authorised_by?: string | null
          behaviour_support_plan_url?: string | null
          behaviour_support_practitioner?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_authorised?: boolean
          least_restrictive_review?: string | null
          linked_incident_id?: string | null
          organisation_id: string
          participant_id: string
          practice_type: string
          record_status?: Database["public"]["Enums"]["record_status"]
          reduction_plan?: string | null
          reporting_actions?: string | null
          review_date?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          authorisation_expiry?: string | null
          authorisation_reference?: string | null
          authorised_at?: string | null
          authorised_by?: string | null
          behaviour_support_plan_url?: string | null
          behaviour_support_practitioner?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_authorised?: boolean
          least_restrictive_review?: string | null
          linked_incident_id?: string | null
          organisation_id?: string
          participant_id?: string
          practice_type?: string
          record_status?: Database["public"]["Enums"]["record_status"]
          reduction_plan?: string | null
          reporting_actions?: string | null
          review_date?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "restrictive_practices_linked_incident_id_fkey"
            columns: ["linked_incident_id"]
            isOneToOne: false
            referencedRelation: "incidents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restrictive_practices_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restrictive_practices_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
        ]
      }
      risk_mitigations: {
        Row: {
          action: string
          assigned_to: string | null
          completed_at: string | null
          created_at: string
          created_by: string
          due_date: string | null
          id: string
          risk_id: string
          status: string
        }
        Insert: {
          action: string
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string
          created_by: string
          due_date?: string | null
          id?: string
          risk_id: string
          status?: string
        }
        Update: {
          action?: string
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string
          due_date?: string | null
          id?: string
          risk_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "risk_mitigations_risk_id_fkey"
            columns: ["risk_id"]
            isOneToOne: false
            referencedRelation: "risks"
            referencedColumns: ["id"]
          },
        ]
      }
      risks: {
        Row: {
          assigned_to: string | null
          category: string
          created_at: string
          created_by: string
          date_identified: string | null
          description: string | null
          escalation_required: boolean | null
          existing_controls: string | null
          id: string
          impact: string
          impact_score: number | null
          likelihood: string
          likelihood_score: number | null
          linked_complaint_id: string | null
          linked_incident_id: string | null
          linked_participant_id: string | null
          linked_staff_id: string | null
          organisation_id: string
          record_status: Database["public"]["Enums"]["record_status"]
          residual_risk_score: number | null
          review_date: string | null
          review_frequency: string | null
          risk_level: string | null
          risk_score: number | null
          sensitivity_level: Database["public"]["Enums"]["sensitivity_level"]
          status: string
          team_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          category: string
          created_at?: string
          created_by: string
          date_identified?: string | null
          description?: string | null
          escalation_required?: boolean | null
          existing_controls?: string | null
          id?: string
          impact: string
          impact_score?: number | null
          likelihood: string
          likelihood_score?: number | null
          linked_complaint_id?: string | null
          linked_incident_id?: string | null
          linked_participant_id?: string | null
          linked_staff_id?: string | null
          organisation_id: string
          record_status?: Database["public"]["Enums"]["record_status"]
          residual_risk_score?: number | null
          review_date?: string | null
          review_frequency?: string | null
          risk_level?: string | null
          risk_score?: number | null
          sensitivity_level?: Database["public"]["Enums"]["sensitivity_level"]
          status?: string
          team_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          category?: string
          created_at?: string
          created_by?: string
          date_identified?: string | null
          description?: string | null
          escalation_required?: boolean | null
          existing_controls?: string | null
          id?: string
          impact?: string
          impact_score?: number | null
          likelihood?: string
          likelihood_score?: number | null
          linked_complaint_id?: string | null
          linked_incident_id?: string | null
          linked_participant_id?: string | null
          linked_staff_id?: string | null
          organisation_id?: string
          record_status?: Database["public"]["Enums"]["record_status"]
          residual_risk_score?: number | null
          review_date?: string | null
          review_frequency?: string | null
          risk_level?: string | null
          risk_score?: number | null
          sensitivity_level?: Database["public"]["Enums"]["sensitivity_level"]
          status?: string
          team_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "risks_linked_complaint_id_fkey"
            columns: ["linked_complaint_id"]
            isOneToOne: false
            referencedRelation: "complaints"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "risks_linked_incident_id_fkey"
            columns: ["linked_incident_id"]
            isOneToOne: false
            referencedRelation: "incidents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "risks_linked_participant_id_fkey"
            columns: ["linked_participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "risks_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "risks_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      safeguarding_concerns: {
        Row: {
          ai_confidence_score: number | null
          concern_type: Database["public"]["Enums"]["safeguarding_concern_type"]
          created_at: string
          date_raised: string
          detailed_description: string | null
          escalation_level:
            | Database["public"]["Enums"]["escalation_level"]
            | null
          id: string
          immediate_action_taken: string | null
          immediate_safety_risk: boolean | null
          linked_complaint_id: string | null
          linked_incident_id: string | null
          linked_risk_id: string | null
          organisation_id: string
          outcome: string | null
          participant_id: string
          raised_by: string
          record_status: Database["public"]["Enums"]["record_status"]
          review_notes: string | null
          sensitivity_level: Database["public"]["Enums"]["sensitivity_level"]
          source: Database["public"]["Enums"]["safeguarding_source"]
          status: Database["public"]["Enums"]["safeguarding_status"]
          supervisor_notified: boolean | null
          support_actions: string | null
          team_id: string | null
          updated_at: string
        }
        Insert: {
          ai_confidence_score?: number | null
          concern_type?: Database["public"]["Enums"]["safeguarding_concern_type"]
          created_at?: string
          date_raised?: string
          detailed_description?: string | null
          escalation_level?:
            | Database["public"]["Enums"]["escalation_level"]
            | null
          id?: string
          immediate_action_taken?: string | null
          immediate_safety_risk?: boolean | null
          linked_complaint_id?: string | null
          linked_incident_id?: string | null
          linked_risk_id?: string | null
          organisation_id: string
          outcome?: string | null
          participant_id: string
          raised_by: string
          record_status?: Database["public"]["Enums"]["record_status"]
          review_notes?: string | null
          sensitivity_level?: Database["public"]["Enums"]["sensitivity_level"]
          source?: Database["public"]["Enums"]["safeguarding_source"]
          status?: Database["public"]["Enums"]["safeguarding_status"]
          supervisor_notified?: boolean | null
          support_actions?: string | null
          team_id?: string | null
          updated_at?: string
        }
        Update: {
          ai_confidence_score?: number | null
          concern_type?: Database["public"]["Enums"]["safeguarding_concern_type"]
          created_at?: string
          date_raised?: string
          detailed_description?: string | null
          escalation_level?:
            | Database["public"]["Enums"]["escalation_level"]
            | null
          id?: string
          immediate_action_taken?: string | null
          immediate_safety_risk?: boolean | null
          linked_complaint_id?: string | null
          linked_incident_id?: string | null
          linked_risk_id?: string | null
          organisation_id?: string
          outcome?: string | null
          participant_id?: string
          raised_by?: string
          record_status?: Database["public"]["Enums"]["record_status"]
          review_notes?: string | null
          sensitivity_level?: Database["public"]["Enums"]["sensitivity_level"]
          source?: Database["public"]["Enums"]["safeguarding_source"]
          status?: Database["public"]["Enums"]["safeguarding_status"]
          supervisor_notified?: boolean | null
          support_actions?: string | null
          team_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "safeguarding_concerns_linked_complaint_id_fkey"
            columns: ["linked_complaint_id"]
            isOneToOne: false
            referencedRelation: "complaints"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "safeguarding_concerns_linked_incident_id_fkey"
            columns: ["linked_incident_id"]
            isOneToOne: false
            referencedRelation: "incidents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "safeguarding_concerns_linked_risk_id_fkey"
            columns: ["linked_risk_id"]
            isOneToOne: false
            referencedRelation: "risks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "safeguarding_concerns_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "safeguarding_concerns_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "safeguarding_concerns_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      service_agreements: {
        Row: {
          accessible_format_provided: string | null
          advocate_rights_acknowledged: boolean
          agreement_number: string
          cancellation_terms: string | null
          complaints_path: string | null
          created_at: string
          created_by: string | null
          emergency_continuity_arrangement: string | null
          end_date: string | null
          ended_reason: string | null
          id: string
          organisation_id: string
          participant_id: string
          price_notes: string | null
          privacy_notice_acknowledged: boolean
          record_status: Database["public"]["Enums"]["record_status"]
          signature_method: string | null
          signed_at: string | null
          signed_by_name: string | null
          signed_copy_url: string | null
          start_date: string | null
          status: Database["public"]["Enums"]["service_agreement_status"]
          support_items: Json
          updated_at: string
        }
        Insert: {
          accessible_format_provided?: string | null
          advocate_rights_acknowledged?: boolean
          agreement_number: string
          cancellation_terms?: string | null
          complaints_path?: string | null
          created_at?: string
          created_by?: string | null
          emergency_continuity_arrangement?: string | null
          end_date?: string | null
          ended_reason?: string | null
          id?: string
          organisation_id: string
          participant_id: string
          price_notes?: string | null
          privacy_notice_acknowledged?: boolean
          record_status?: Database["public"]["Enums"]["record_status"]
          signature_method?: string | null
          signed_at?: string | null
          signed_by_name?: string | null
          signed_copy_url?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["service_agreement_status"]
          support_items?: Json
          updated_at?: string
        }
        Update: {
          accessible_format_provided?: string | null
          advocate_rights_acknowledged?: boolean
          agreement_number?: string
          cancellation_terms?: string | null
          complaints_path?: string | null
          created_at?: string
          created_by?: string | null
          emergency_continuity_arrangement?: string | null
          end_date?: string | null
          ended_reason?: string | null
          id?: string
          organisation_id?: string
          participant_id?: string
          price_notes?: string | null
          privacy_notice_acknowledged?: boolean
          record_status?: Database["public"]["Enums"]["record_status"]
          signature_method?: string | null
          signed_at?: string | null
          signed_by_name?: string | null
          signed_copy_url?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["service_agreement_status"]
          support_items?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_agreements_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_agreements_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
        ]
      }
      service_types: {
        Row: {
          active: boolean
          business_category_id: string
          code: string
          created_at: string
          description: string | null
          display_order: number
          high_risk: boolean
          id: string
          name: string
          requires_clinical_governance: boolean
          requires_participant_management: boolean
          requires_photos: boolean
          requires_registration_group: boolean
          requires_worker_screening: boolean
          supports_geolocation: boolean
          updated_at: string
        }
        Insert: {
          active?: boolean
          business_category_id: string
          code: string
          created_at?: string
          description?: string | null
          display_order?: number
          high_risk?: boolean
          id?: string
          name: string
          requires_clinical_governance?: boolean
          requires_participant_management?: boolean
          requires_photos?: boolean
          requires_registration_group?: boolean
          requires_worker_screening?: boolean
          supports_geolocation?: boolean
          updated_at?: string
        }
        Update: {
          active?: boolean
          business_category_id?: string
          code?: string
          created_at?: string
          description?: string | null
          display_order?: number
          high_risk?: boolean
          id?: string
          name?: string
          requires_clinical_governance?: boolean
          requires_participant_management?: boolean
          requires_photos?: boolean
          requires_registration_group?: boolean
          requires_worker_screening?: boolean
          supports_geolocation?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_types_business_category_id_fkey"
            columns: ["business_category_id"]
            isOneToOne: false
            referencedRelation: "business_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      sil_configuration: {
        Row: {
          confirmed_at: string | null
          confirmed_by: string | null
          created_at: string
          id: string
          is_enabled: boolean
          notes: string | null
          organisation_id: string
          registration_confirmed: boolean
          updated_at: string
        }
        Insert: {
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          id?: string
          is_enabled?: boolean
          notes?: string | null
          organisation_id: string
          registration_confirmed?: boolean
          updated_at?: string
        }
        Update: {
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          id?: string
          is_enabled?: boolean
          notes?: string | null
          organisation_id?: string
          registration_confirmed?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sil_configuration_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: true
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      sil_house_drills: {
        Row: {
          created_at: string
          drill_date: string
          drill_type: string
          house_id: string
          id: string
          issues_identified: string | null
          next_due_date: string | null
          organisation_id: string
          outcome: string | null
          participants_involved: Json
          recorded_by: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          drill_date: string
          drill_type: string
          house_id: string
          id?: string
          issues_identified?: string | null
          next_due_date?: string | null
          organisation_id: string
          outcome?: string | null
          participants_involved?: Json
          recorded_by?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          drill_date?: string
          drill_type?: string
          house_id?: string
          id?: string
          issues_identified?: string | null
          next_due_date?: string | null
          organisation_id?: string
          outcome?: string | null
          participants_involved?: Json
          recorded_by?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sil_house_drills_house_id_fkey"
            columns: ["house_id"]
            isOneToOne: false
            referencedRelation: "sil_houses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sil_house_drills_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      sil_houses: {
        Row: {
          address: string | null
          created_at: string
          house_emergency_plan: string | null
          id: string
          name: string
          organisation_id: string
          plan_review_date: string | null
          record_status: Database["public"]["Enums"]["record_status"]
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          house_emergency_plan?: string | null
          id?: string
          name: string
          organisation_id: string
          plan_review_date?: string | null
          record_status?: Database["public"]["Enums"]["record_status"]
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          house_emergency_plan?: string | null
          id?: string
          name?: string
          organisation_id?: string
          plan_review_date?: string | null
          record_status?: Database["public"]["Enums"]["record_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sil_houses_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      sil_tenancy_agreements: {
        Row: {
          accessible_copy_provided: boolean
          agreement_number: string
          co_tenant_consultation: string | null
          conflict_safeguarding_plan: string | null
          created_at: string
          created_by: string | null
          ended_reason: string | null
          house_id: string | null
          id: string
          independent_of_service_agreement: boolean
          keys_private_space_preferences: string | null
          organisation_id: string
          participant_id: string
          record_status: Database["public"]["Enums"]["record_status"]
          rights_acknowledged: boolean
          shared_space_decisions: string | null
          signature_method: string | null
          signed_at: string | null
          signed_by_name: string | null
          signed_copy_url: string | null
          status: Database["public"]["Enums"]["service_agreement_status"]
          tenancy_end: string | null
          tenancy_start: string | null
          updated_at: string
          vacancy_consultation: string | null
          visitor_preferences: string | null
        }
        Insert: {
          accessible_copy_provided?: boolean
          agreement_number: string
          co_tenant_consultation?: string | null
          conflict_safeguarding_plan?: string | null
          created_at?: string
          created_by?: string | null
          ended_reason?: string | null
          house_id?: string | null
          id?: string
          independent_of_service_agreement?: boolean
          keys_private_space_preferences?: string | null
          organisation_id: string
          participant_id: string
          record_status?: Database["public"]["Enums"]["record_status"]
          rights_acknowledged?: boolean
          shared_space_decisions?: string | null
          signature_method?: string | null
          signed_at?: string | null
          signed_by_name?: string | null
          signed_copy_url?: string | null
          status?: Database["public"]["Enums"]["service_agreement_status"]
          tenancy_end?: string | null
          tenancy_start?: string | null
          updated_at?: string
          vacancy_consultation?: string | null
          visitor_preferences?: string | null
        }
        Update: {
          accessible_copy_provided?: boolean
          agreement_number?: string
          co_tenant_consultation?: string | null
          conflict_safeguarding_plan?: string | null
          created_at?: string
          created_by?: string | null
          ended_reason?: string | null
          house_id?: string | null
          id?: string
          independent_of_service_agreement?: boolean
          keys_private_space_preferences?: string | null
          organisation_id?: string
          participant_id?: string
          record_status?: Database["public"]["Enums"]["record_status"]
          rights_acknowledged?: boolean
          shared_space_decisions?: string | null
          signature_method?: string | null
          signed_at?: string | null
          signed_by_name?: string | null
          signed_copy_url?: string | null
          status?: Database["public"]["Enums"]["service_agreement_status"]
          tenancy_end?: string | null
          tenancy_start?: string | null
          updated_at?: string
          vacancy_consultation?: string | null
          visitor_preferences?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sil_tenancy_agreements_house_id_fkey"
            columns: ["house_id"]
            isOneToOne: false
            referencedRelation: "sil_houses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sil_tenancy_agreements_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sil_tenancy_agreements_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_compliance: {
        Row: {
          code_of_conduct_acknowledged: boolean | null
          code_of_conduct_date: string | null
          created_at: string
          cyber_safety_completed: boolean | null
          eligible_for_assignment: boolean | null
          id: string
          identity_verification: boolean | null
          incident_mgmt_training: boolean | null
          mandatory_induction: boolean | null
          ndis_screening_required: boolean | null
          overall_compliance_pct: number | null
          police_check_date: string | null
          police_check_expiry: string | null
          police_check_status: string
          restrictions_notes: string | null
          safeguarding_training: boolean | null
          start_date: string | null
          updated_at: string
          user_id: string
          worker_orientation: boolean | null
          worker_screening_expiry: string | null
          worker_screening_status: string
          wwcc_expiry: string | null
          wwcc_number: string | null
          wwcc_status: string
        }
        Insert: {
          code_of_conduct_acknowledged?: boolean | null
          code_of_conduct_date?: string | null
          created_at?: string
          cyber_safety_completed?: boolean | null
          eligible_for_assignment?: boolean | null
          id?: string
          identity_verification?: boolean | null
          incident_mgmt_training?: boolean | null
          mandatory_induction?: boolean | null
          ndis_screening_required?: boolean | null
          overall_compliance_pct?: number | null
          police_check_date?: string | null
          police_check_expiry?: string | null
          police_check_status?: string
          restrictions_notes?: string | null
          safeguarding_training?: boolean | null
          start_date?: string | null
          updated_at?: string
          user_id: string
          worker_orientation?: boolean | null
          worker_screening_expiry?: string | null
          worker_screening_status?: string
          wwcc_expiry?: string | null
          wwcc_number?: string | null
          wwcc_status?: string
        }
        Update: {
          code_of_conduct_acknowledged?: boolean | null
          code_of_conduct_date?: string | null
          created_at?: string
          cyber_safety_completed?: boolean | null
          eligible_for_assignment?: boolean | null
          id?: string
          identity_verification?: boolean | null
          incident_mgmt_training?: boolean | null
          mandatory_induction?: boolean | null
          ndis_screening_required?: boolean | null
          overall_compliance_pct?: number | null
          police_check_date?: string | null
          police_check_expiry?: string | null
          police_check_status?: string
          restrictions_notes?: string | null
          safeguarding_training?: boolean | null
          start_date?: string | null
          updated_at?: string
          user_id?: string
          worker_orientation?: boolean | null
          worker_screening_expiry?: string | null
          worker_screening_status?: string
          wwcc_expiry?: string | null
          wwcc_number?: string | null
          wwcc_status?: string
        }
        Relationships: []
      }
      staff_compliance_records: {
        Row: {
          created_at: string
          expiry_date: string | null
          id: string
          issue_date: string | null
          notes: string | null
          organisation_id: string
          rejection_reason: string | null
          requirement_code: string
          requirement_name: string
          staff_id: string
          status: Database["public"]["Enums"]["compliance_record_status"]
          updated_at: string
          uploaded_file_url: string | null
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          created_at?: string
          expiry_date?: string | null
          id?: string
          issue_date?: string | null
          notes?: string | null
          organisation_id: string
          rejection_reason?: string | null
          requirement_code: string
          requirement_name: string
          staff_id: string
          status?: Database["public"]["Enums"]["compliance_record_status"]
          updated_at?: string
          uploaded_file_url?: string | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          created_at?: string
          expiry_date?: string | null
          id?: string
          issue_date?: string | null
          notes?: string | null
          organisation_id?: string
          rejection_reason?: string | null
          requirement_code?: string
          requirement_name?: string
          staff_id?: string
          status?: Database["public"]["Enums"]["compliance_record_status"]
          updated_at?: string
          uploaded_file_url?: string | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "staff_compliance_records_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_compliance_requirements: {
        Row: {
          applies_to_roles: Json | null
          created_at: string
          description: string | null
          expiry_required: boolean
          id: string
          is_mandatory: boolean
          organisation_id: string
          requirement_code: string
          requirement_name: string
          role_name: string
          updated_at: string
          validity_months: number | null
        }
        Insert: {
          applies_to_roles?: Json | null
          created_at?: string
          description?: string | null
          expiry_required?: boolean
          id?: string
          is_mandatory?: boolean
          organisation_id: string
          requirement_code: string
          requirement_name: string
          role_name: string
          updated_at?: string
          validity_months?: number | null
        }
        Update: {
          applies_to_roles?: Json | null
          created_at?: string
          description?: string | null
          expiry_required?: boolean
          id?: string
          is_mandatory?: boolean
          organisation_id?: string
          requirement_code?: string
          requirement_name?: string
          role_name?: string
          updated_at?: string
          validity_months?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "staff_compliance_requirements_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_conduct_events: {
        Row: {
          action_taken: string | null
          created_at: string
          created_by: string
          description: string | null
          event_type: string
          id: string
          organisation_id: string
          source_record_id: string | null
          source_type: Database["public"]["Enums"]["conduct_source_type"]
          staff_id: string
        }
        Insert: {
          action_taken?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          event_type: string
          id?: string
          organisation_id: string
          source_record_id?: string | null
          source_type?: Database["public"]["Enums"]["conduct_source_type"]
          staff_id: string
        }
        Update: {
          action_taken?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          event_type?: string
          id?: string
          organisation_id?: string
          source_record_id?: string | null
          source_type?: Database["public"]["Enums"]["conduct_source_type"]
          staff_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_conduct_events_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_eligibility_status: {
        Row: {
          created_at: string
          eligibility_status: Database["public"]["Enums"]["eligibility_status"]
          evaluated_by_system: boolean
          id: string
          is_eligible_for_assignment: boolean
          last_evaluated_at: string
          organisation_id: string
          reason_summary: string | null
          staff_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          eligibility_status?: Database["public"]["Enums"]["eligibility_status"]
          evaluated_by_system?: boolean
          id?: string
          is_eligible_for_assignment?: boolean
          last_evaluated_at?: string
          organisation_id: string
          reason_summary?: string | null
          staff_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          eligibility_status?: Database["public"]["Enums"]["eligibility_status"]
          evaluated_by_system?: boolean
          id?: string
          is_eligible_for_assignment?: boolean
          last_evaluated_at?: string
          organisation_id?: string
          reason_summary?: string | null
          staff_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_eligibility_status_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_position_requirements: {
        Row: {
          backup_arrangement: string | null
          created_at: string
          description: string | null
          emergency_capability: string | null
          id: string
          ndis_orientation_required: boolean
          organisation_id: string
          position_title: string
          required_qualifications: Json
          required_training: Json
          supervision_frequency: string | null
          updated_at: string
          worker_screening_required: boolean
        }
        Insert: {
          backup_arrangement?: string | null
          created_at?: string
          description?: string | null
          emergency_capability?: string | null
          id?: string
          ndis_orientation_required?: boolean
          organisation_id: string
          position_title: string
          required_qualifications?: Json
          required_training?: Json
          supervision_frequency?: string | null
          updated_at?: string
          worker_screening_required?: boolean
        }
        Update: {
          backup_arrangement?: string | null
          created_at?: string
          description?: string | null
          emergency_capability?: string | null
          id?: string
          ndis_orientation_required?: boolean
          organisation_id?: string
          position_title?: string
          required_qualifications?: Json
          required_training?: Json
          supervision_frequency?: string | null
          updated_at?: string
          worker_screening_required?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "staff_position_requirements_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      standard_modules: {
        Row: {
          code: string
          created_at: string
          description: string | null
          id: string
          is_conditional: boolean
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          id?: string
          is_conditional?: boolean
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          is_conditional?: boolean
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      subscription_packages: {
        Row: {
          archived_at: string | null
          code: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          included_users: number | null
          is_active: boolean
          module_entitlements: string[]
          monthly_price: number
          name: string
          trial_days: number
          unlimited_users: boolean
          updated_at: string
          version: number
        }
        Insert: {
          archived_at?: string | null
          code: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          included_users?: number | null
          is_active?: boolean
          module_entitlements?: string[]
          monthly_price?: number
          name: string
          trial_days?: number
          unlimited_users?: boolean
          updated_at?: string
          version?: number
        }
        Update: {
          archived_at?: string | null
          code?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          included_users?: number | null
          is_active?: boolean
          module_entitlements?: string[]
          monthly_price?: number
          name?: string
          trial_days?: number
          unlimited_users?: boolean
          updated_at?: string
          version?: number
        }
        Relationships: []
      }
      support_plans: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          communication_method: string | null
          community_participation: string | null
          created_at: string
          created_by: string | null
          culture_values_beliefs: string | null
          daily_support_needs: string | null
          decision_making_supports: string | null
          emergency_contacts: Json
          goals: string | null
          health_contacts: Json
          id: string
          organisation_id: string
          participant_id: string
          participant_involved: boolean
          preferences: string | null
          record_status: Database["public"]["Enums"]["record_status"]
          review_due_date: string | null
          status: Database["public"]["Enums"]["support_plan_status"]
          strengths: string | null
          support_network_permissions: Json
          updated_at: string
          version_number: number
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          communication_method?: string | null
          community_participation?: string | null
          created_at?: string
          created_by?: string | null
          culture_values_beliefs?: string | null
          daily_support_needs?: string | null
          decision_making_supports?: string | null
          emergency_contacts?: Json
          goals?: string | null
          health_contacts?: Json
          id?: string
          organisation_id: string
          participant_id: string
          participant_involved?: boolean
          preferences?: string | null
          record_status?: Database["public"]["Enums"]["record_status"]
          review_due_date?: string | null
          status?: Database["public"]["Enums"]["support_plan_status"]
          strengths?: string | null
          support_network_permissions?: Json
          updated_at?: string
          version_number?: number
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          communication_method?: string | null
          community_participation?: string | null
          created_at?: string
          created_by?: string | null
          culture_values_beliefs?: string | null
          daily_support_needs?: string | null
          decision_making_supports?: string | null
          emergency_contacts?: Json
          goals?: string | null
          health_contacts?: Json
          id?: string
          organisation_id?: string
          participant_id?: string
          participant_involved?: boolean
          preferences?: string | null
          record_status?: Database["public"]["Enums"]["record_status"]
          review_due_date?: string | null
          status?: Database["public"]["Enums"]["support_plan_status"]
          strengths?: string | null
          support_network_permissions?: Json
          updated_at?: string
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "support_plans_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_plans_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assigned_to: string | null
          created_at: string
          created_by: string
          description: string | null
          due_date: string | null
          id: string
          notes: string | null
          organisation_id: string
          priority: string | null
          record_status: Database["public"]["Enums"]["record_status"]
          source_module: string | null
          source_record_id: string | null
          status: Database["public"]["Enums"]["task_status"]
          task_type: string | null
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          due_date?: string | null
          id?: string
          notes?: string | null
          organisation_id: string
          priority?: string | null
          record_status?: Database["public"]["Enums"]["record_status"]
          source_module?: string | null
          source_record_id?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          task_type?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          due_date?: string | null
          id?: string
          notes?: string | null
          organisation_id?: string
          priority?: string | null
          record_status?: Database["public"]["Enums"]["record_status"]
          source_module?: string | null
          source_record_id?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          task_type?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          organisation_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          organisation_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          organisation_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "teams_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_subscriptions: {
        Row: {
          cancelled_at: string | null
          created_at: string
          created_by: string | null
          current_period_end: string | null
          current_period_start: string | null
          id: string
          internal_notes: string | null
          manual_payment_status: string
          monthly_price: number
          organisation_id: string
          package_id: string
          renewal_date: string | null
          seats_included: number | null
          status: string
          trial_end_date: string | null
          trial_start_date: string | null
          unlimited_users: boolean
          updated_at: string
        }
        Insert: {
          cancelled_at?: string | null
          created_at?: string
          created_by?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          internal_notes?: string | null
          manual_payment_status?: string
          monthly_price?: number
          organisation_id: string
          package_id: string
          renewal_date?: string | null
          seats_included?: number | null
          status?: string
          trial_end_date?: string | null
          trial_start_date?: string | null
          unlimited_users?: boolean
          updated_at?: string
        }
        Update: {
          cancelled_at?: string | null
          created_at?: string
          created_by?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          internal_notes?: string | null
          manual_payment_status?: string
          monthly_price?: number
          organisation_id?: string
          package_id?: string
          renewal_date?: string | null
          seats_included?: number | null
          status?: string
          trial_end_date?: string | null
          trial_start_date?: string | null
          unlimited_users?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_subscriptions_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_subscriptions_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "subscription_packages"
            referencedColumns: ["id"]
          },
        ]
      }
      training_completions: {
        Row: {
          assessment_passed: boolean | null
          certificate_url: string | null
          completion_date: string | null
          compliance_outcome: string | null
          created_at: string
          delivery_method: string | null
          duration_hours: number | null
          evidence_file_url: string | null
          evidence_type: string | null
          expiry_date: string | null
          facilitator: string | null
          id: string
          linked_incident_id: string | null
          module_id: string
          notes: string | null
          organisation_id: string | null
          rejection_reason: string | null
          retraining_due_date: string | null
          retraining_reason: string | null
          score: number | null
          status: string
          training_code: string | null
          updated_at: string
          user_id: string
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          assessment_passed?: boolean | null
          certificate_url?: string | null
          completion_date?: string | null
          compliance_outcome?: string | null
          created_at?: string
          delivery_method?: string | null
          duration_hours?: number | null
          evidence_file_url?: string | null
          evidence_type?: string | null
          expiry_date?: string | null
          facilitator?: string | null
          id?: string
          linked_incident_id?: string | null
          module_id: string
          notes?: string | null
          organisation_id?: string | null
          rejection_reason?: string | null
          retraining_due_date?: string | null
          retraining_reason?: string | null
          score?: number | null
          status?: string
          training_code?: string | null
          updated_at?: string
          user_id: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          assessment_passed?: boolean | null
          certificate_url?: string | null
          completion_date?: string | null
          compliance_outcome?: string | null
          created_at?: string
          delivery_method?: string | null
          duration_hours?: number | null
          evidence_file_url?: string | null
          evidence_type?: string | null
          expiry_date?: string | null
          facilitator?: string | null
          id?: string
          linked_incident_id?: string | null
          module_id?: string
          notes?: string | null
          organisation_id?: string | null
          rejection_reason?: string | null
          retraining_due_date?: string | null
          retraining_reason?: string | null
          score?: number | null
          status?: string
          training_code?: string | null
          updated_at?: string
          user_id?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "training_completions_linked_incident_id_fkey"
            columns: ["linked_incident_id"]
            isOneToOne: false
            referencedRelation: "incidents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_completions_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "training_modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_completions_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      training_modules: {
        Row: {
          created_at: string
          description: string | null
          duration_hours: number | null
          id: string
          module_type: string
          organisation_id: string
          required_for_roles: Database["public"]["Enums"]["app_role"][] | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          duration_hours?: number | null
          id?: string
          module_type?: string
          organisation_id: string
          required_for_roles?: Database["public"]["Enums"]["app_role"][] | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          duration_hours?: number | null
          id?: string
          module_type?: string
          organisation_id?: string
          required_for_roles?: Database["public"]["Enums"]["app_role"][] | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "training_modules_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      training_requirements: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_mandatory: boolean
          linked_module_id: string | null
          min_pass_score: number | null
          organisation_id: string
          required_for_roles: Json | null
          training_code: string
          training_name: string
          updated_at: string
          validity_months: number | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_mandatory?: boolean
          linked_module_id?: string | null
          min_pass_score?: number | null
          organisation_id: string
          required_for_roles?: Json | null
          training_code: string
          training_name: string
          updated_at?: string
          validity_months?: number | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_mandatory?: boolean
          linked_module_id?: string | null
          min_pass_score?: number | null
          organisation_id?: string
          required_for_roles?: Json | null
          training_code?: string
          training_name?: string
          updated_at?: string
          validity_months?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "training_requirements_linked_module_id_fkey"
            columns: ["linked_module_id"]
            isOneToOne: false
            referencedRelation: "training_modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_requirements_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_profiles: {
        Row: {
          active_status: boolean
          avatar_url: string | null
          clearance_status: string | null
          created_at: string
          data_scope: string | null
          email: string
          full_name: string
          id: string
          last_login: string | null
          mfa_enabled: boolean
          organisation_id: string | null
          permitted_modules: string[] | null
          team_id: string | null
          updated_at: string
        }
        Insert: {
          active_status?: boolean
          avatar_url?: string | null
          clearance_status?: string | null
          created_at?: string
          data_scope?: string | null
          email: string
          full_name: string
          id: string
          last_login?: string | null
          mfa_enabled?: boolean
          organisation_id?: string | null
          permitted_modules?: string[] | null
          team_id?: string | null
          updated_at?: string
        }
        Update: {
          active_status?: boolean
          avatar_url?: string | null
          clearance_status?: string | null
          created_at?: string
          data_scope?: string | null
          email?: string
          full_name?: string
          id?: string
          last_login?: string | null
          mfa_enabled?: boolean
          organisation_id?: string | null
          permitted_modules?: string[] | null
          team_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_profiles_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_profiles_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      waste_register: {
        Row: {
          created_at: string
          description: string | null
          disposal_contractor: string | null
          disposal_date: string | null
          disposal_method: string | null
          handled_by: string | null
          id: string
          linked_incident_id: string | null
          notes: string | null
          organisation_id: string
          ppe_used: string | null
          quantity: string | null
          record_status: Database["public"]["Enums"]["record_status"]
          spill_or_accident: boolean
          storage_location: string | null
          updated_at: string
          waste_type: Database["public"]["Enums"]["waste_type"]
        }
        Insert: {
          created_at?: string
          description?: string | null
          disposal_contractor?: string | null
          disposal_date?: string | null
          disposal_method?: string | null
          handled_by?: string | null
          id?: string
          linked_incident_id?: string | null
          notes?: string | null
          organisation_id: string
          ppe_used?: string | null
          quantity?: string | null
          record_status?: Database["public"]["Enums"]["record_status"]
          spill_or_accident?: boolean
          storage_location?: string | null
          updated_at?: string
          waste_type: Database["public"]["Enums"]["waste_type"]
        }
        Update: {
          created_at?: string
          description?: string | null
          disposal_contractor?: string | null
          disposal_date?: string | null
          disposal_method?: string | null
          handled_by?: string | null
          id?: string
          linked_incident_id?: string | null
          notes?: string | null
          organisation_id?: string
          ppe_used?: string | null
          quantity?: string | null
          record_status?: Database["public"]["Enums"]["record_status"]
          spill_or_accident?: boolean
          storage_location?: string | null
          updated_at?: string
          waste_type?: Database["public"]["Enums"]["waste_type"]
        }
        Relationships: [
          {
            foreignKeyName: "waste_register_linked_incident_id_fkey"
            columns: ["linked_incident_id"]
            isOneToOne: false
            referencedRelation: "incidents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waste_register_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      worker_assignments: {
        Row: {
          blocked_reason: string | null
          briefing_support_plan_id: string | null
          created_at: string
          created_by: string | null
          end_date: string | null
          id: string
          organisation_id: string
          participant_id: string
          plan_briefing_completed: boolean
          plan_briefing_date: string | null
          record_status: Database["public"]["Enums"]["record_status"]
          role_on_team: string | null
          start_date: string | null
          status: string
          updated_at: string
          worker_id: string
        }
        Insert: {
          blocked_reason?: string | null
          briefing_support_plan_id?: string | null
          created_at?: string
          created_by?: string | null
          end_date?: string | null
          id?: string
          organisation_id: string
          participant_id: string
          plan_briefing_completed?: boolean
          plan_briefing_date?: string | null
          record_status?: Database["public"]["Enums"]["record_status"]
          role_on_team?: string | null
          start_date?: string | null
          status?: string
          updated_at?: string
          worker_id: string
        }
        Update: {
          blocked_reason?: string | null
          briefing_support_plan_id?: string | null
          created_at?: string
          created_by?: string | null
          end_date?: string | null
          id?: string
          organisation_id?: string
          participant_id?: string
          plan_briefing_completed?: boolean
          plan_briefing_date?: string | null
          record_status?: Database["public"]["Enums"]["record_status"]
          role_on_team?: string | null
          start_date?: string | null
          status?: string
          updated_at?: string
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "worker_assignments_briefing_support_plan_id_fkey"
            columns: ["briefing_support_plan_id"]
            isOneToOne: false
            referencedRelation: "support_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "worker_assignments_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "worker_assignments_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      assert_same_org_staff: { Args: { _staff_id: string }; Returns: undefined }
      can_access_form_attachment: {
        Args: { _object_name: string }
        Returns: boolean
      }
      can_access_participant: {
        Args: { _participant_id: string }
        Returns: boolean
      }
      check_declining_outcomes: {
        Args: { _goal_id: string; _participant_id: string }
        Returns: boolean
      }
      check_incident_handler_training: {
        Args: { _user_id: string }
        Returns: Json
      }
      check_incident_handler_training_impl: {
        Args: { _user_id: string }
        Returns: Json
      }
      check_incident_time_breaches: { Args: never; Returns: Json }
      check_staff_assignment_eligible: {
        Args: { _staff_id: string }
        Returns: boolean
      }
      check_staff_assignment_eligible_impl: {
        Args: { _staff_id: string }
        Returns: boolean
      }
      confirm_service_selections: {
        Args: { _ndis_funding_status: string; _org: string }
        Returns: Json
      }
      evaluate_staff_eligibility: { Args: { _staff_id: string }; Returns: Json }
      evaluate_staff_eligibility_impl: {
        Args: { _staff_id: string }
        Returns: Json
      }
      generate_evidence_requirements: {
        Args: { _org: string }
        Returns: number
      }
      generate_org_policies: { Args: { _org: string }; Returns: number }
      get_participant_id_for_user: {
        Args: { _user_id: string }
        Returns: string
      }
      get_user_organisation_id: { Args: { _user_id: string }; Returns: string }
      get_user_team_id: { Args: { _user_id: string }; Returns: string }
      has_any_role: {
        Args: {
          _roles: Database["public"]["Enums"]["app_role"][]
          _user_id: string
        }
        Returns: boolean
      }
      has_current_training: {
        Args: { _code: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      insert_notification_deduped: {
        Args: {
          _dedupe_bucket: string
          _fingerprint: string
          _link: string
          _message: string
          _notification_type: string
          _organisation_id: string
          _severity: string
          _source_record_id: string
          _source_table: string
          _title: string
          _user_id: string
        }
        Returns: boolean
      }
      is_platform_admin: { Args: { _user_id?: string }; Returns: boolean }
      is_tenant_admin: { Args: { _user_id?: string }; Returns: boolean }
      is_test_title: { Args: { _title: string }; Returns: boolean }
      org_compliance_snapshot: {
        Args: { _include_test?: boolean }
        Returns: Json
      }
      organisation_active_modules: { Args: { _org: string }; Returns: string[] }
      organisation_applicable_requirements: {
        Args: { _org: string }
        Returns: {
          label: string
          required: boolean
          requirement_reference: string
          requirement_type: string
          source: string
        }[]
      }
      platform_dashboard_summary: { Args: never; Returns: Json }
    }
    Enums: {
      app_role:
        | "super_admin"
        | "compliance_officer"
        | "supervisor"
        | "trainer"
        | "support_worker"
        | "hr_admin"
        | "executive"
        | "participant"
        | "platform_super_admin"
        | "tenant_admin"
      complaint_category:
        | "service_quality"
        | "staff_conduct"
        | "delay"
        | "communication"
        | "privacy"
        | "safeguarding"
        | "billing"
        | "other"
      complaint_source_type:
        | "participant"
        | "family"
        | "advocate"
        | "staff"
        | "external"
      complaint_status:
        | "submitted"
        | "under_review"
        | "investigating"
        | "resolved"
        | "closed"
      compliance_record_status:
        | "missing"
        | "pending_review"
        | "verified"
        | "expiring_soon"
        | "expired"
        | "rejected"
      conduct_source_type: "incident" | "complaint" | "manual_review"
      consent_status: "granted" | "withdrawn" | "pending"
      eligibility_status:
        | "compliant"
        | "expiring_soon"
        | "non_compliant"
        | "suspended"
      environment_type:
        | "office"
        | "remote"
        | "digital_platform"
        | "phone_call"
        | "other"
      escalation_level: "monitor" | "urgent_review" | "immediate_intervention"
      evidence_status:
        | "missing"
        | "in_progress"
        | "ready"
        | "overdue"
        | "ready_for_review"
        | "not_applicable"
      incident_category:
        | "injury"
        | "emotional_distress"
        | "abuse_allegation"
        | "neglect_concern"
        | "privacy_breach"
        | "behavioural_event"
        | "service_disruption"
        | "other"
      incident_severity: "low" | "medium" | "high" | "critical"
      incident_status:
        | "reported"
        | "review"
        | "investigating"
        | "actioned"
        | "closed"
        | "draft"
        | "submitted"
        | "supervisor_review"
        | "compliance_review"
      medication_admin_result:
        | "administered"
        | "refused"
        | "withheld"
        | "missed"
        | "self_administered"
      policy_status: "draft" | "review" | "approved" | "published" | "archived"
      privacy_incident_status:
        | "detected"
        | "contained"
        | "assessed"
        | "actioned"
        | "closed"
      privacy_incident_type:
        | "unauthorised_access"
        | "misdirected_email"
        | "lost_device"
        | "suspicious_login"
        | "oversharing"
        | "export_misuse"
        | "other"
      qualification_type:
        | "qualification"
        | "licence"
        | "induction"
        | "certification"
      record_status: "active" | "archived" | "deleted"
      risk_status: "open" | "assessed" | "mitigating" | "monitoring" | "closed"
      safeguarding_concern_type:
        | "distress"
        | "abuse_concern"
        | "neglect_concern"
        | "exploitation"
        | "digital_safety"
        | "self_harm"
        | "behavioural_change"
        | "isolation"
        | "other"
      safeguarding_source:
        | "staff_observation"
        | "ai_alert"
        | "complaint"
        | "participant_disclosure"
        | "external_report"
      safeguarding_status:
        | "raised"
        | "screened"
        | "action_required"
        | "monitoring"
        | "resolved"
        | "closed"
      sensitivity_level:
        | "public"
        | "internal"
        | "controlled"
        | "sensitive"
        | "highly_sensitive"
      service_agreement_status:
        | "draft"
        | "participant_review"
        | "signed"
        | "active"
        | "ended"
        | "archived"
      submission_channel: "phone" | "email" | "web_form" | "in_person" | "other"
      support_plan_status: "draft" | "active" | "superseded" | "archived"
      task_status: "pending" | "in_progress" | "completed" | "cancelled"
      waste_type:
        | "general"
        | "clinical"
        | "sharps"
        | "infectious"
        | "hazardous"
        | "other"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: [
        "super_admin",
        "compliance_officer",
        "supervisor",
        "trainer",
        "support_worker",
        "hr_admin",
        "executive",
        "participant",
        "platform_super_admin",
        "tenant_admin",
      ],
      complaint_category: [
        "service_quality",
        "staff_conduct",
        "delay",
        "communication",
        "privacy",
        "safeguarding",
        "billing",
        "other",
      ],
      complaint_source_type: [
        "participant",
        "family",
        "advocate",
        "staff",
        "external",
      ],
      complaint_status: [
        "submitted",
        "under_review",
        "investigating",
        "resolved",
        "closed",
      ],
      compliance_record_status: [
        "missing",
        "pending_review",
        "verified",
        "expiring_soon",
        "expired",
        "rejected",
      ],
      conduct_source_type: ["incident", "complaint", "manual_review"],
      consent_status: ["granted", "withdrawn", "pending"],
      eligibility_status: [
        "compliant",
        "expiring_soon",
        "non_compliant",
        "suspended",
      ],
      environment_type: [
        "office",
        "remote",
        "digital_platform",
        "phone_call",
        "other",
      ],
      escalation_level: ["monitor", "urgent_review", "immediate_intervention"],
      evidence_status: [
        "missing",
        "in_progress",
        "ready",
        "overdue",
        "ready_for_review",
        "not_applicable",
      ],
      incident_category: [
        "injury",
        "emotional_distress",
        "abuse_allegation",
        "neglect_concern",
        "privacy_breach",
        "behavioural_event",
        "service_disruption",
        "other",
      ],
      incident_severity: ["low", "medium", "high", "critical"],
      incident_status: [
        "reported",
        "review",
        "investigating",
        "actioned",
        "closed",
        "draft",
        "submitted",
        "supervisor_review",
        "compliance_review",
      ],
      medication_admin_result: [
        "administered",
        "refused",
        "withheld",
        "missed",
        "self_administered",
      ],
      policy_status: ["draft", "review", "approved", "published", "archived"],
      privacy_incident_status: [
        "detected",
        "contained",
        "assessed",
        "actioned",
        "closed",
      ],
      privacy_incident_type: [
        "unauthorised_access",
        "misdirected_email",
        "lost_device",
        "suspicious_login",
        "oversharing",
        "export_misuse",
        "other",
      ],
      qualification_type: [
        "qualification",
        "licence",
        "induction",
        "certification",
      ],
      record_status: ["active", "archived", "deleted"],
      risk_status: ["open", "assessed", "mitigating", "monitoring", "closed"],
      safeguarding_concern_type: [
        "distress",
        "abuse_concern",
        "neglect_concern",
        "exploitation",
        "digital_safety",
        "self_harm",
        "behavioural_change",
        "isolation",
        "other",
      ],
      safeguarding_source: [
        "staff_observation",
        "ai_alert",
        "complaint",
        "participant_disclosure",
        "external_report",
      ],
      safeguarding_status: [
        "raised",
        "screened",
        "action_required",
        "monitoring",
        "resolved",
        "closed",
      ],
      sensitivity_level: [
        "public",
        "internal",
        "controlled",
        "sensitive",
        "highly_sensitive",
      ],
      service_agreement_status: [
        "draft",
        "participant_review",
        "signed",
        "active",
        "ended",
        "archived",
      ],
      submission_channel: ["phone", "email", "web_form", "in_person", "other"],
      support_plan_status: ["draft", "active", "superseded", "archived"],
      task_status: ["pending", "in_progress", "completed", "cancelled"],
      waste_type: [
        "general",
        "clinical",
        "sharps",
        "infectious",
        "hazardous",
        "other",
      ],
    },
  },
} as const
