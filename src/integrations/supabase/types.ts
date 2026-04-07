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
          assigned_to: string | null
          complaint_number: string
          created_at: string
          description: string | null
          id: string
          organisation_id: string
          participant_id: string | null
          priority: string
          record_status: Database["public"]["Enums"]["record_status"]
          resolved_at: string | null
          sensitivity_level: Database["public"]["Enums"]["sensitivity_level"]
          status: Database["public"]["Enums"]["complaint_status"]
          subject: string
          submitted_by: string | null
          submitted_by_name: string | null
          team_id: string | null
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          complaint_number: string
          created_at?: string
          description?: string | null
          id?: string
          organisation_id: string
          participant_id?: string | null
          priority?: string
          record_status?: Database["public"]["Enums"]["record_status"]
          resolved_at?: string | null
          sensitivity_level?: Database["public"]["Enums"]["sensitivity_level"]
          status?: Database["public"]["Enums"]["complaint_status"]
          subject: string
          submitted_by?: string | null
          submitted_by_name?: string | null
          team_id?: string | null
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          complaint_number?: string
          created_at?: string
          description?: string | null
          id?: string
          organisation_id?: string
          participant_id?: string | null
          priority?: string
          record_status?: Database["public"]["Enums"]["record_status"]
          resolved_at?: string | null
          sensitivity_level?: Database["public"]["Enums"]["sensitivity_level"]
          status?: Database["public"]["Enums"]["complaint_status"]
          subject?: string
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
          assigned_to: string | null
          closed_at: string | null
          closed_by: string | null
          created_at: string
          description: string | null
          id: string
          incident_number: string
          incident_type: string
          injury_involved: boolean
          is_reportable: boolean
          ndis_notification_deadline: string | null
          organisation_id: string
          participant_id: string | null
          record_status: Database["public"]["Enums"]["record_status"]
          reported_by: string
          sensitivity_level: Database["public"]["Enums"]["sensitivity_level"]
          severity: Database["public"]["Enums"]["incident_severity"]
          status: Database["public"]["Enums"]["incident_status"]
          team_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          description?: string | null
          id?: string
          incident_number: string
          incident_type: string
          injury_involved?: boolean
          is_reportable?: boolean
          ndis_notification_deadline?: string | null
          organisation_id: string
          participant_id?: string | null
          record_status?: Database["public"]["Enums"]["record_status"]
          reported_by: string
          sensitivity_level?: Database["public"]["Enums"]["sensitivity_level"]
          severity?: Database["public"]["Enums"]["incident_severity"]
          status?: Database["public"]["Enums"]["incident_status"]
          team_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          description?: string | null
          id?: string
          incident_number?: string
          incident_type?: string
          injury_involved?: boolean
          is_reportable?: boolean
          ndis_notification_deadline?: string | null
          organisation_id?: string
          participant_id?: string | null
          record_status?: Database["public"]["Enums"]["record_status"]
          reported_by?: string
          sensitivity_level?: Database["public"]["Enums"]["sensitivity_level"]
          severity?: Database["public"]["Enums"]["incident_severity"]
          status?: Database["public"]["Enums"]["incident_status"]
          team_id?: string | null
          title?: string
          updated_at?: string
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
            foreignKeyName: "incidents_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          link: string | null
          message: string | null
          notification_type: string
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          message?: string | null
          notification_type?: string
          title: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          message?: string | null
          notification_type?: string
          title?: string
          user_id?: string
        }
        Relationships: []
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
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          linked_training_module_id: string | null
          participant_id: string
          status: string
          target_date: string | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          linked_training_module_id?: string | null
          participant_id: string
          status?: string
          target_date?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          linked_training_module_id?: string | null
          participant_id?: string
          status?: string
          target_date?: string | null
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
          sensitivity_level: Database["public"]["Enums"]["sensitivity_level"]
          status: string
          team_id: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          assigned_trainer_id?: string | null
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
          sensitivity_level?: Database["public"]["Enums"]["sensitivity_level"]
          status?: string
          team_id?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          assigned_trainer_id?: string | null
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
          sensitivity_level?: Database["public"]["Enums"]["sensitivity_level"]
          status?: string
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
          approved_at: string | null
          approved_by: string | null
          created_at: string
          current_version: number
          id: string
          last_review_date: string | null
          next_review_date: string | null
          organisation_id: string
          owner_id: string | null
          published_at: string | null
          record_status: Database["public"]["Enums"]["record_status"]
          status: Database["public"]["Enums"]["policy_status"]
          title: string
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          current_version?: number
          id?: string
          last_review_date?: string | null
          next_review_date?: string | null
          organisation_id: string
          owner_id?: string | null
          published_at?: string | null
          record_status?: Database["public"]["Enums"]["record_status"]
          status?: Database["public"]["Enums"]["policy_status"]
          title: string
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          current_version?: number
          id?: string
          last_review_date?: string | null
          next_review_date?: string | null
          organisation_id?: string
          owner_id?: string | null
          published_at?: string | null
          record_status?: Database["public"]["Enums"]["record_status"]
          status?: Database["public"]["Enums"]["policy_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "policies_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
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
          description: string | null
          id: string
          impact: string
          likelihood: string
          organisation_id: string
          record_status: Database["public"]["Enums"]["record_status"]
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
          description?: string | null
          id?: string
          impact: string
          likelihood: string
          organisation_id: string
          record_status?: Database["public"]["Enums"]["record_status"]
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
          description?: string | null
          id?: string
          impact?: string
          likelihood?: string
          organisation_id?: string
          record_status?: Database["public"]["Enums"]["record_status"]
          sensitivity_level?: Database["public"]["Enums"]["sensitivity_level"]
          status?: string
          team_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
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
      staff_compliance: {
        Row: {
          created_at: string
          id: string
          overall_compliance_pct: number | null
          police_check_date: string | null
          police_check_expiry: string | null
          police_check_status: string
          updated_at: string
          user_id: string
          worker_screening_expiry: string | null
          worker_screening_status: string
          wwcc_expiry: string | null
          wwcc_number: string | null
          wwcc_status: string
        }
        Insert: {
          created_at?: string
          id?: string
          overall_compliance_pct?: number | null
          police_check_date?: string | null
          police_check_expiry?: string | null
          police_check_status?: string
          updated_at?: string
          user_id: string
          worker_screening_expiry?: string | null
          worker_screening_status?: string
          wwcc_expiry?: string | null
          wwcc_number?: string | null
          wwcc_status?: string
        }
        Update: {
          created_at?: string
          id?: string
          overall_compliance_pct?: number | null
          police_check_date?: string | null
          police_check_expiry?: string | null
          police_check_status?: string
          updated_at?: string
          user_id?: string
          worker_screening_expiry?: string | null
          worker_screening_status?: string
          wwcc_expiry?: string | null
          wwcc_number?: string | null
          wwcc_status?: string
        }
        Relationships: []
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
          certificate_url: string | null
          completion_date: string | null
          created_at: string
          expiry_date: string | null
          id: string
          module_id: string
          score: number | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          certificate_url?: string | null
          completion_date?: string | null
          created_at?: string
          expiry_date?: string | null
          id?: string
          module_id: string
          score?: number | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          certificate_url?: string | null
          completion_date?: string | null
          created_at?: string
          expiry_date?: string | null
          id?: string
          module_id?: string
          score?: number | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "training_completions_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "training_modules"
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
      complaint_status:
        | "submitted"
        | "under_review"
        | "investigating"
        | "resolved"
        | "closed"
      incident_severity: "low" | "medium" | "high" | "critical"
      incident_status:
        | "reported"
        | "review"
        | "investigating"
        | "actioned"
        | "closed"
      policy_status: "draft" | "review" | "approved" | "published" | "archived"
      record_status: "active" | "archived" | "deleted"
      sensitivity_level:
        | "public"
        | "internal"
        | "controlled"
        | "sensitive"
        | "highly_sensitive"
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
      complaint_status: [
        "submitted",
        "under_review",
        "investigating",
        "resolved",
        "closed",
      ],
      incident_severity: ["low", "medium", "high", "critical"],
      incident_status: [
        "reported",
        "review",
        "investigating",
        "actioned",
        "closed",
      ],
      policy_status: ["draft", "review", "approved", "published", "archived"],
      record_status: ["active", "archived", "deleted"],
      sensitivity_level: [
        "public",
        "internal",
        "controlled",
        "sensitive",
        "highly_sensitive",
      ],
    },
  },
} as const
