import { useState } from "react";
import { Activity, RefreshCw, Radio } from "lucide-react";
import { useStationMonitor, StationStatus } from "@/hooks/useStationMonitor";
import { StationCard } from "@/components/StationCard";
import { ReportDialog } from "@/components/ReportDialog";
import { Button } from "@/components/ui/button";

const Index = () => {
  const { statuses, refresh } = useStationMonitor();
  const [selectedStation, setSelectedStation] = useState<StationStatus | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const onlineCount = statuses.filter((s) => s.online).length;
  const totalListeners = statuses.reduce((sum, s) => sum + s.listeners, 0);

  const handleReport = (status: StationStatus) => {
    setSelectedStation(status);
    setDialogOpen(true);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <Radio className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="font-display font-bold text-lg text-foreground leading-tight">
                Streaming Monitor
              </h1>
              <p className="text-xs text-muted-foreground">Rádios de Natal/RN</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-4 text-sm">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <Activity className="h-4 w-4 text-online" />
                <span className="font-mono font-medium text-foreground">{onlineCount}</span> online
              </span>
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <span className="font-mono font-medium text-foreground">
                  {totalListeners.toLocaleString("pt-BR")}
                </span> conexões
              </span>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={refresh}
              className="border-border text-muted-foreground hover:text-foreground"
            >
              <RefreshCw className="h-4 w-4 mr-1.5" />
              Atualizar
            </Button>
          </div>
        </div>
      </header>

      {/* Grid */}
      <main className="container max-w-6xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {statuses.map((status) => (
            <StationCard
              key={status.station.id}
              status={status}
              onReport={() => handleReport(status)}
            />
          ))}
        </div>
      </main>

      {/* Report dialog */}
      <ReportDialog
        status={selectedStation}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </div>
  );
};

export default Index;
