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
      certifications: {
        Row: {
          certificate_url: string | null
          created_at: string
          expiry_date: string | null
          id: string
          issue_date: string
          issuer: string | null
          name: string
          status: string
          user_id: string
        }
        Insert: {
          certificate_url?: string | null
          created_at?: string
          expiry_date?: string | null
          id?: string
          issue_date: string
          issuer?: string | null
          name: string
          status?: string
          user_id: string
        }
        Update: {
          certificate_url?: string | null
          created_at?: string
          expiry_date?: string | null
          id?: string
          issue_date?: string
          issuer?: string | null
          name?: string
          status?: string
          user_id?: string
        }
        Relationships: []
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
      incident_actions: {
        Row: {
          action_type: string
          assigned_to: string | null
          completed_at: string | null
          created_at: string
          created_by: string
          description: string
          due_date: string | null
          id: string
          incident_id: string
          notes: string | null
          status: string
          updated_at: string
        }
        Insert: {
          action_type?: string
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string
          created_by: string
          description: string
          due_date?: string | null
          id?: string
          incident_id: string
          notes?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          action_type?: string
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string
          description?: string
          due_date?: string | null
          id?: string
          incident_id?: string
          notes?: string | null
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
          participant_followup_completed: boolean | null
          participant_harmed: boolean | null
          participant_id: string | null
          practice_standard_id: string | null
          preventive_actions: string | null
          record_status: Database["public"]["Enums"]["record_status"]
          reportable_reason: string | null
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
          participant_followup_completed?: boolean | null
          participant_harmed?: boolean | null
          participant_id?: string | null
          practice_standard_id?: string | null
          preventive_actions?: string | null
          record_status?: Database["public"]["Enums"]["record_status"]
          reportable_reason?: string | null
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
          participant_followup_completed?: boolean | null
          participant_harmed?: boolean | null
          participant_id?: string | null
          practice_standard_id?: string | null
          preventive_actions?: string | null
          record_status?: Database["public"]["Enums"]["record_status"]
          reportable_reason?: string | null
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
      organisations: {
        Row: {
          abn: string | null
          created_at: string
          id: string
          name: string
          ndis_registration: string | null
          primary_contact_email: string | null
          updated_at: string
        }
        Insert: {
          abn?: string | null
          created_at?: string
          id?: string
          name: string
          ndis_registration?: string | null
          primary_contact_email?: string | null
          updated_at?: string
        }
        Update: {
          abn?: string | null
          created_at?: string
          id?: string
          name?: string
          ndis_registration?: string | null
          primary_contact_email?: string | null
          updated_at?: string
        }
        Relationships: []
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
      participants: {
        Row: {
          address: string | null
          assigned_trainer_id: string | null
          consent_date: string | null
          consent_status: Database["public"]["Enums"]["consent_status"]
          created_at: string
          created_by: string | null
          date_of_birth: string | null
          email: string | null
          first_name: string
          government_id: string | null
          id: string
          last_name: string
          ndis_number: string | null
          organisation_id: string
          phone: string | null
          record_status: Database["public"]["Enums"]["record_status"]
          risk_flags: string[] | null
          sensitivity_level: Database["public"]["Enums"]["sensitivity_level"]
          status: string
          support_type: string | null
          team_id: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          assigned_trainer_id?: string | null
          consent_date?: string | null
          consent_status?: Database["public"]["Enums"]["consent_status"]
          created_at?: string
          created_by?: string | null
          date_of_birth?: string | null
          email?: string | null
          first_name: string
          government_id?: string | null
          id?: string
          last_name: string
          ndis_number?: string | null
          organisation_id: string
          phone?: string | null
          record_status?: Database["public"]["Enums"]["record_status"]
          risk_flags?: string[] | null
          sensitivity_level?: Database["public"]["Enums"]["sensitivity_level"]
          status?: string
          support_type?: string | null
          team_id?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          assigned_trainer_id?: string | null
          consent_date?: string | null
          consent_status?: Database["public"]["Enums"]["consent_status"]
          created_at?: string
          created_by?: string | null
          date_of_birth?: string | null
          email?: string | null
          first_name?: string
          government_id?: string | null
          id?: string
          last_name?: string
          ndis_number?: string | null
          organisation_id?: string
          phone?: string | null
          record_status?: Database["public"]["Enums"]["record_status"]
          risk_flags?: string[] | null
          sensitivity_level?: Database["public"]["Enums"]["sensitivity_level"]
          status?: string
          support_type?: string | null
          team_id?: string | null
          updated_at?: string
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
          linked_training_module_id: string | null
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
          linked_training_module_id?: string | null
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
          linked_training_module_id?: string | null
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
            foreignKeyName: "policies_linked_training_module_id_fkey"
            columns: ["linked_training_module_id"]
            isOneToOne: false
            referencedRelation: "training_modules"
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
      practice_standards: {
        Row: {
          category: string
          code: string
          created_at: string
          description: string | null
          id: string
          name: string
        }
        Insert: {
          category: string
          code: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          category?: string
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      check_declining_outcomes: {
        Args: { _goal_id: string; _participant_id: string }
        Returns: boolean
      }
      check_incident_handler_training: {
        Args: { _user_id: string }
        Returns: Json
      }
      check_incident_time_breaches: { Args: never; Returns: Json }
      check_staff_assignment_eligible: {
        Args: { _staff_id: string }
        Returns: boolean
      }
      evaluate_staff_eligibility: { Args: { _staff_id: string }; Returns: Json }
      get_user_organisation_id: { Args: { _user_id: string }; Returns: string }
      get_user_team_id: { Args: { _user_id: string }; Returns: string }
      has_any_role: {
        Args: {
          _roles: Database["public"]["Enums"]["app_role"][]
          _user_id: string
        }
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
      submission_channel: "phone" | "email" | "web_form" | "in_person" | "other"
      task_status: "pending" | "in_progress" | "completed" | "cancelled"
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
      submission_channel: ["phone", "email", "web_form", "in_person", "other"],
      task_status: ["pending", "in_progress", "completed", "cancelled"],
    },
  },
} as const
