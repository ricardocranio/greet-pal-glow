import { useState, useEffect } from "react";
import { Activity, RefreshCw, Radio, Volume2, VolumeX, Download, Clock, Volume1 } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { useStationMonitor, StationStatus } from "@/hooks/useStationMonitor";
import { StationCard } from "@/components/StationCard";
import { ReportDialog } from "@/components/ReportDialog";
import { AudienceRanking } from "@/components/AudienceRanking";
import { AudioProvider, useAudioPlayer } from "@/hooks/useAudioPlayer";
import { Button } from "@/components/ui/button";
import { generateAudienceReport } from "@/utils/generateReport";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

function BrasiliaClock() {
  const [time, setTime] = useState("");

  useEffect(() => {
    const update = () => {
      const now = new Date();
      const brasilia = now.toLocaleTimeString("pt-BR", {
        timeZone: "America/Sao_Paulo",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
      setTime(brasilia);
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
      <Clock className="h-3.5 w-3.5 text-primary" />
      <span className="font-mono font-medium text-foreground">{time}</span>
      <span className="text-[10px] uppercase">Brasília</span>
    </div>
  );
}

function NowPlayingBar() {
  const { playingStationId, stop, volume, setVolume } = useAudioPlayer();
  if (!playingStationId) return null;

  const VolumeIcon = volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-20 bg-card/95 backdrop-blur-sm border-t border-border">
      <div className="container max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Volume2 className="h-4 w-4 text-primary animate-pulse" />
          <span className="text-sm text-foreground font-display">Reproduzindo ao vivo</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 w-32">
            <VolumeIcon className="h-4 w-4 text-muted-foreground shrink-0" />
            <Slider
              value={[volume * 100]}
              onValueChange={([v]) => setVolume(v / 100)}
              max={100}
              step={1}
              className="w-full"
            />
          </div>
          <Button size="sm" variant="outline" onClick={stop} className="text-xs border-border text-muted-foreground">
            <VolumeX className="h-4 w-4 mr-1.5" />
            Parar
          </Button>
        </div>
      </div>
    </div>
  );
}

function IndexContent() {
  const { statuses, refresh } = useStationMonitor();
  const [selectedStation, setSelectedStation] = useState<StationStatus | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const onlineCount = statuses.filter((s) => s.online).length;
  const totalListeners = statuses.reduce((sum, s) => sum + s.listeners, 0);

  const handleReport = (status: StationStatus) => {
    setSelectedStation(status);
    setDialogOpen(true);
  };

  const handleDownloadReport = async () => {
    setDownloading(true);
    try {
      // Fetch last 90 days of snapshots from DB
      const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
      const { data: snapshots, error } = await supabase
        .from('audience_snapshots')
        .select('station_id, listeners, peak_listeners, hour, recorded_at')
        .gte('recorded_at', cutoff)
        .order('recorded_at', { ascending: true });

      if (error) {
        console.error('Failed to fetch snapshots:', error);
        toast.error('Erro ao buscar dados históricos');
      }

      await generateAudienceReport(statuses, snapshots ?? []);
      toast.success('Relatório gerado com sucesso!');
    } catch (err) {
      console.error(err);
      toast.error('Erro ao gerar relatório');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-16">
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src="/logo-monitor.png"
              alt="Logo"
              className="h-10 w-10 object-contain rounded-xl"
              width={40}
              height={40}
            />
            <div>
              <h1 className="font-display font-bold text-lg text-foreground leading-tight">
                Monitoramento de Audiência
              </h1>
              <p className="text-xs text-muted-foreground">Rádios de Natal/RN</p>
              <p className="text-[10px] text-muted-foreground/60">by Ricardo Amaral</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <BrasiliaClock />
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
              onClick={handleDownloadReport}
              disabled={downloading}
              className="border-border text-muted-foreground hover:text-foreground"
            >
              <Download className="h-4 w-4 mr-1.5" />
              {downloading ? 'Gerando...' : 'Relatório'}
            </Button>
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
