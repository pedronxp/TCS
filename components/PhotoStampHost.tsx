import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import { PedidoCarimbo, registrarRenderizadorCarimbo } from '../services/photoStampService';

interface Job extends PedidoCarimbo {
  id: number;
  width: number;
  height: number;
  pixelWidth: number;
  pixelHeight: number;
}

/** A imagem precisa carregar E ser diagramada antes da captura nativa. */
function StampCanvas({ job, finish }: { job: Job; finish: (id: number, uri?: string, error?: Error) => void }) {
  const canvas = useRef<React.ElementRef<typeof View>>(null);
  const [loaded, setLoaded] = useState(false);
  const [laidOut, setLaidOut] = useState(false);
  useEffect(() => {
    if (!loaded || !laidOut) return;
    let cancelled = false;
    let secondFrame: number | undefined;
    const firstFrame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(() => {
        if (cancelled) return;
        void Promise.resolve().then(() => captureRef(canvas, {
          format: 'jpg', quality: 0.95, result: 'tmpfile', width: job.pixelWidth, height: job.pixelHeight,
        }))
          .then(uri => { if (!cancelled) finish(job.id, uri); })
          .catch(() => { if (!cancelled) finish(job.id, undefined, new Error('Não foi possível gravar o carimbo na foto.')); });
      });
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(firstFrame);
      if (secondFrame !== undefined) cancelAnimationFrame(secondFrame);
    };
  }, [loaded, laidOut, job.id, job.pixelWidth, job.pixelHeight, finish]);

  return (
    <View ref={canvas} collapsable={false} testID="photo-stamp-canvas"
      onLayout={() => setLaidOut(true)}
      style={{ width: job.width, height: job.height, backgroundColor: '#171717' }}>
      <Image testID="photo-stamp-image" source={{ uri: job.uri }}
        style={StyleSheet.absoluteFill} resizeMode="contain"
        onLoad={() => setLoaded(true)}
        onError={() => finish(job.id, undefined, new Error('Não foi possível carregar a foto para o carimbo.'))} />
      <View style={styles.stamp}>
        {job.carimbo.linhas.map((line, index) => (
          <Text key={index} allowFontScaling={false} style={[styles.line, { fontSize: Math.max(9, job.width / 30), lineHeight: Math.max(12, job.width / 23) }]}>
            {line}
          </Text>
        ))}
      </View>
    </View>
  );
}

/** Montado na raiz para atender também fotos tiradas dentro do formulário. */
export function PhotoStampHost() {
  const dimensions = useWindowDimensions();
  const dimensionsRef = useRef(dimensions);
  dimensionsRef.current = dimensions;
  const [job, setJob] = useState<Job | null>(null);
  const sequence = useRef(0);
  const active = useRef<{
    id: number;
    resolve: (uri: string) => void;
    reject: (error: Error) => void;
    timer: ReturnType<typeof setTimeout>;
  } | null>(null);
  const finish = useCallback((id: number, uri?: string, error?: Error) => {
    const pending = active.current;
    if (!pending || pending.id !== id) return;
    active.current = null;
    clearTimeout(pending.timer);
    setJob(null);
    if (uri) pending.resolve(uri);
    else pending.reject(error ?? new Error('Falha ao processar foto.'));
  }, []);

  useEffect(() => {
    const unregister = registrarRenderizadorCarimbo(pedido => new Promise<string>((resolve, reject) => {
      const id = ++sequence.current;
      active.current = {
        id, resolve, reject,
        timer: setTimeout(() => finish(id, undefined, new Error('Tempo limite ao gravar o carimbo.')), 12000),
      };
      Image.getSize(pedido.uri, (width, height) => {
        if (active.current?.id !== id) return;
        if (width <= 0 || height <= 0) {
          finish(id, undefined, new Error('Dimensões inválidas da foto.'));
          return;
        }
        const current = dimensionsRef.current;
        const displayWidth = Math.max(1, Math.min(current.width - 32, 400, (current.height - 140) * width / height));
        setJob({ ...pedido, id, width: displayWidth, height: displayWidth * height / width, pixelWidth: width, pixelHeight: height });
      }, () => finish(id, undefined, new Error('Não foi possível carregar a foto.')));
    }));
    return () => {
      unregister();
      if (active.current) {
        clearTimeout(active.current.timer);
        active.current.reject(new Error('Processamento da foto interrompido.'));
        active.current = null;
      }
    };
  }, [finish]);

  if (!job) return null;
  return (
    <View style={styles.processing} accessibilityViewIsModal>
      <StampCanvas key={job.id} job={job} finish={finish} />
      <ActivityIndicator color="#FFF" style={{ marginTop: 16 }} />
      <Text style={styles.processingText}>Gravando localização na foto…</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  processing: { ...StyleSheet.absoluteFill, zIndex: 10000, elevation: 100, backgroundColor: '#171717', alignItems: 'center', justifyContent: 'center' },
  processingText: { color: '#FFF', fontSize: 14, marginTop: 8 },
  stamp: { position: 'absolute', bottom: 6, left: 6, right: 6, padding: 6, backgroundColor: 'rgba(0,0,0,0.78)' },
  line: { color: '#FFF', fontWeight: '500' },
});
