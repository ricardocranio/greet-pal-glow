import { useState, useEffect } from "react";
import { Activity, RefreshCw, Radio, Volume2, VolumeX, Download, Clock, Volume1, Filter, ChurchIcon, Building2, Zap, LogOut } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { useStationMonitor, StationStatus } from "@/hooks/useStationMonitor";
import { StationCard } from "@/components/StationCard";
import { ReportDialog } from "@/components/ReportDialog";
import { AudienceRanking } from "@/components/AudienceRanking";
import { AudioProvider, useAudioPlayer } from "@/hooks/useAudioPlayer";
import { Button } from "@/components/ui/button";
import { generateAudienceReport } from "@/utils/generateReport";
import { supabase } from "@/integrations/supabase/client";
import { stations } from "@/data/stations";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

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
      <span className="font-mono font-medium text-foreground tabular-nums whitespace-nowrap">{time}</span>
      <span className="text-[10px] uppercase">Brasília</span>
    </div>
  );
}

function NowPlayingBar() {
  const { playingStationId, stop, volume, setVolume, error } = useAudioPlayer();
  if (!playingStationId && !error) return null;

  const VolumeIcon = volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-20 bg-card border-t border-border">
      <div className="container max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {error ? (
            <span className="text-xs text-destructive">{error}</span>
          ) : (
            <>
              <Volume2 className="h-4 w-4 text-primary animate-pulse" />
              <span className="text-sm text-foreground font-display">Reproduzindo ao vivo</span>
            </>
          )}
        </div>
        <div className="flex items-center gap-3">
          {!error && (
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
          )}
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
  const {
    statuses, allStatuses, refresh,
    visibleStations, toggleStation,
    showReligious, setShowReligious,
    showState, setShowState,
    simulatorEnabled, setSimulatorEnabled,
    simulatorFactor, setSimulatorFactor,
  } = useStationMonitor();
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
      <header className="border-b border-border bg-card sticky top-0 z-10">
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

          <div className="flex items-center gap-2 sm:gap-4">
            <BrasiliaClock />
            <div className="hidden sm:flex items-center gap-4 text-sm">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <Activity className="h-4 w-4 text-online" />
                <span className="font-mono font-medium text-foreground tabular-nums">{onlineCount}</span> online
              </span>
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <span className="font-mono font-medium text-foreground tabular-nums whitespace-nowrap">
                  {totalListeners.toLocaleString("pt-BR")}
                </span> conexões
                {simulatorEnabled && <span className="text-[9px] text-accent">(Fi {simulatorFactor})</span>}
              </span>
            </div>

            {/* Filter popover */}
            <Popover>
              <PopoverTrigger asChild>
                <Button size="sm" variant="outline" className="border-border text-muted-foreground hover:text-foreground">
                  <Filter className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-72 bg-card border-border" align="end">
                <div className="space-y-4">
                  <h4 className="font-display font-semibold text-sm text-foreground">Filtros</h4>
                  
                  {/* Category toggles */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                        <ChurchIcon className="h-3.5 w-3.5" /> Religiosas
                      </span>
                      <Switch checked={showReligious} onCheckedChange={setShowReligious} />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                        <Building2 className="h-3.5 w-3.5" /> Estatais
                      </span>
                      <Switch checked={showState} onCheckedChange={setShowState} />
                    </div>
                  </div>

                  <div className="border-t border-border pt-3">
                    <p className="text-[10px] text-muted-foreground mb-2 uppercase tracking-wide">Emissoras visíveis</p>
                    <div className="space-y-1.5 max-h-48 overflow-y-auto">
                      {stations
                        .filter(s => {
                          if (s.category === 'religious' && !showReligious) return false;
                          if (s.category === 'state' && !showState) return false;
                          return true;
                        })
                        .map(s => (
                          <label key={s.id} className="flex items-center gap-2 cursor-pointer">
                            <Checkbox
                              checked={visibleStations.has(s.id)}
                              onCheckedChange={() => toggleStation(s.id)}
                            />
                            <span className="text-xs text-foreground">{s.name}</span>
                          </label>
                        ))
                      }
                    </div>
                  </div>

                  {/* Simulator */}
                  <div className="border-t border-border pt-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                        <Zap className="h-3.5 w-3.5" /> Fator de Interpolação
                      </span>
                      <Switch checked={simulatorEnabled} onCheckedChange={setSimulatorEnabled} />
                    </div>
                    {simulatorEnabled && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">Fator: Fi {simulatorFactor}</span>
                          <span className="text-[10px] text-muted-foreground">60-80</span>
                        </div>
                        <Slider
                          value={[simulatorFactor]}
                          onValueChange={([v]) => setSimulatorFactor(v)}
                          min={60}
                          max={80}
                          step={1}
                          className="w-full"
                        />
                      </div>
                    )}
                  </div>
                </div>
              </PopoverContent>
            </Popover>

            <Button
              size="sm"
              variant="outline"
              onClick={handleDownloadReport}
              disabled={downloading}
              className="border-border text-muted-foreground hover:text-foreground"
            >
              <Download className="h-4 w-4 mr-1.5" />
              <span className="hidden sm:inline">{downloading ? 'Gerando...' : 'Relatório'}</span>
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={refresh}
              className="border-border text-muted-foreground hover:text-foreground"
            >
              <RefreshCw className="h-4 w-4 sm:mr-1.5" />
              <span className="hidden sm:inline">Atualizar</span>
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                sessionStorage.removeItem("auth_token");
                window.location.reload();
              }}
              className="border-border text-destructive hover:text-destructive hover:bg-destructive/10"
              title="Sair"
            >
              <LogOut className="h-4 w-4" />
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
        visibleStations={visibleStations}
        simulatorEnabled={simulatorEnabled}
        simulatorFactor={simulatorFactor}
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
