import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Dimensions, Image } from 'react-native';
import { PhotoStampHost } from '../PhotoStampHost';
import { aplicarCarimboFoto } from '../../services/photoStampService';
import { captureRef } from 'react-native-view-shot';

jest.mock('react-native-view-shot', () => ({ captureRef: jest.fn(async () => 'file:///stamped.jpg') }));
jest.mock('expo-location', () => ({}));
jest.mock('@react-native-community/netinfo', () => ({ __esModule: true, default: {} }));

// Inicializar o renderer nativo no Windows pode ultrapassar 5s durante o bundle
// Metro. Os prazos do produto continuam sendo verificados com relógio simulado.
jest.setTimeout(15000);

describe('composição da foto', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    jest.spyOn(Image, 'getSize').mockImplementation((uri, success) => { success(854, 1138); });
  });
  afterEach(() => { jest.restoreAllMocks(); jest.useRealTimers(); });

  it('renderiza o endereço e espera a imagem e o layout antes de salvar', async () => {
    render(<PhotoStampHost />);
    let result!: Promise<string>;
    await act(async () => {
      result = aplicarCarimboFoto({ uri: 'file:///source.jpg', carimbo: {
        endereco: 'Astolfo Dutra · MG', linhas: ['Astolfo Dutra · MG', 'GPS -21.310000, -42.860000'],
      } });
    });
    expect(screen.getByText('Astolfo Dutra · MG')).toBeTruthy();
    expect(captureRef).not.toHaveBeenCalled();
    fireEvent(screen.getByTestId('photo-stamp-image'), 'load');
    expect(captureRef).not.toHaveBeenCalled();
    await act(async () => {
      fireEvent(screen.getByTestId('photo-stamp-canvas'), 'layout', { nativeEvent: { layout: { width: 300, height: 400 } } });
    });
    await act(async () => { await jest.advanceTimersByTimeAsync(100); });
    await expect(result).resolves.toBe('file:///stamped.jpg');
    expect(captureRef).toHaveBeenCalledTimes(1);
  });

  it('erro ao carregar imagem encerra o pedido sem produzir foto vazia', async () => {
    render(<PhotoStampHost />);
    let result!: Promise<string>;
    await act(async () => {
      result = aplicarCarimboFoto({ uri: 'file:///missing.jpg', carimbo: { endereco: null, linhas: ['Localização indisponível'] } });
    });
    const failed = expect(result).rejects.toThrow('carregar');
    await act(async () => { fireEvent(screen.getByTestId('photo-stamp-image'), 'error'); });
    await failed;
    expect(captureRef).not.toHaveBeenCalled();
  });

  it('redimensionar a tela durante o processamento não abandona a foto nem bloqueia o app', async () => {
    render(<PhotoStampHost />);
    let result!: Promise<string>;
    await act(async () => {
      result = aplicarCarimboFoto({ uri: 'file:///source.jpg', carimbo: { endereco: null, linhas: ['GPS -21.310000, -42.860000'] } });
    });
    const outcome = result.then(uri => ({ uri }), error => ({ error: error.message }));
    await act(async () => { Dimensions.set({ window: { width: 800, height: 600, scale: 2, fontScale: 1 } }); });
    fireEvent(screen.getByTestId('photo-stamp-image'), 'load');
    await act(async () => {
      fireEvent(screen.getByTestId('photo-stamp-canvas'), 'layout', { nativeEvent: { layout: { width: 300, height: 400 } } });
    });
    await act(async () => { await jest.advanceTimersByTimeAsync(100); });
    await expect(outcome).resolves.toEqual({ uri: 'file:///stamped.jpg' });
    expect(screen.queryByText('Gravando localização na foto…')).toBeNull();
  });

  it('timeout de carregamento encerra o pedido e remove a tela de processamento', async () => {
    render(<PhotoStampHost />);
    let result!: Promise<string>;
    await act(async () => {
      result = aplicarCarimboFoto({ uri: 'file:///source.jpg', carimbo: { endereco: null, linhas: ['GPS'] } });
    });
    const failed = expect(result).rejects.toThrow('Tempo limite');
    await act(async () => { await jest.advanceTimersByTimeAsync(12000); });
    await failed;
    expect(screen.queryByText('Gravando localização na foto…')).toBeNull();
  });

  it('módulo nativo indisponível retorna erro controlado e libera a tela', async () => {
    (captureRef as jest.Mock).mockImplementationOnce(() => { throw new Error('native unavailable'); });
    render(<PhotoStampHost />);
    let result!: Promise<string>;
    await act(async () => {
      result = aplicarCarimboFoto({ uri: 'file:///source.jpg', carimbo: { endereco: null, linhas: ['GPS'] } });
    });
    const outcome = result.then(uri => ({ uri }), error => ({ error: error.message }));
    await act(async () => {
      fireEvent(screen.getByTestId('photo-stamp-image'), 'load');
      fireEvent(screen.getByTestId('photo-stamp-canvas'), 'layout');
    });
    await act(async () => { await jest.advanceTimersByTimeAsync(100); });
    await expect(outcome).resolves.toEqual({ error: 'Não foi possível gravar o carimbo na foto.' });
    expect(screen.queryByText('Gravando localização na foto…')).toBeNull();
  });
});
