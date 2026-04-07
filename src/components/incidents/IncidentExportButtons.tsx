import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, FileText, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import {
  fetchIncidentExportData,
  exportIncidentCSV,
  exportBulkIncidentsCSV,
  downloadCSV,
} from "@/lib/incidentExport";

interface SingleExportProps {
  incidentId: string;
  incidentNumber: string;
}

export function IncidentExportButton({ incidentId, incidentNumber }: SingleExportProps) {
  const [loading, setLoading] = useState(false);

  const handleExport = async () => {
    setLoading(true);
    try {
      const data = await fetchIncidentExportData(incidentId);
      const csv = exportIncidentCSV(data);
      downloadCSV(csv, `${incidentNumber}-full-export.csv`);
      toast({ title: "Exported", description: `${incidentNumber} exported with full timeline.` });
    } catch (err: any) {
      toast({ title: "Export failed", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button size="sm" variant="outline" onClick={handleExport} disabled={loading}>
      {loading ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Download className="h-3 w-3 mr-1" />}
      Export CSV
    </Button>
  );
}

interface BulkExportProps {
  incidents: any[];
}

export function BulkIncidentExportButton({ incidents }: BulkExportProps) {
  const handleExport = () => {
    if (incidents.length === 0) {
      toast({ title: "No incidents to export" });
      return;
    }
    const csv = exportBulkIncidentsCSV(incidents);
    downloadCSV(csv, `incidents-bulk-export-${new Date().toISOString().split("T")[0]}.csv`);
    toast({ title: "Exported", description: `${incidents.length} incidents exported.` });
  };

  return (
    <Button size="sm" variant="outline" onClick={handleExport}>
      <FileText className="h-3 w-3 mr-1" />
      Export All CSV
    </Button>
  );
}
