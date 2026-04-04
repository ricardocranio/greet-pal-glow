import { useState } from "react";
import { Activity, RefreshCw, Radio, Volume2, VolumeX } from "lucide-react";
import { useStationMonitor, StationStatus } from "@/hooks/useStationMonitor";
import { StationCard } from "@/components/StationCard";
import { ReportDialog } from "@/components/ReportDialog";
import { AudienceRanking } from "@/components/AudienceRanking";
import { AudioProvider, useAudioPlayer } from "@/hooks/useAudioPlayer";
import { Button } from "@/components/ui/button";

function NowPlayingBar() {
  const { playingStationId, stop } = useAudioPlayer();
  if (!playingStationId) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-20 bg-card/95 backdrop-blur-sm border-t border-border">
      <div className="container max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Volume2 className="h-4 w-4 text-primary animate-pulse" />
          <span className="text-sm text-foreground font-display">Reproduzindo ao vivo</span>
        </div>
        <Button size="sm" variant="outline" onClick={stop} className="text-xs border-border text-muted-foreground">
          <VolumeX className="h-4 w-4 mr-1.5" />
          Parar
        </Button>
      </div>
    </div>
  );
}

function IndexContent() {
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
    <div className="min-h-screen bg-background pb-16">
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

      <main className="container max-w-6xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Station cards */}
          <div className="lg:col-span-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {statuses.map((status) => (
                <StationCard
                  key={status.station.id}
                  status={status}
                  onReport={() => handleReport(status)}
                />
              ))}
            </div>
          </div>

          {/* Ranking sidebar */}
          <div className="lg:col-span-1">
            <div className="sticky top-24">
              <AudienceRanking statuses={statuses} />
            </div>
          </div>
        </div>
      </main>

      <NowPlayingBar />

      <ReportDialog
        status={selectedStation}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </div>
  );
}

const Index = () => (
  <AudioProvider>
    <IndexContent />
  </AudioProvider>
);

export default Index;
