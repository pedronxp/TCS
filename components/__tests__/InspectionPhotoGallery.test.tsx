import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { PanResponder } from 'react-native';
import { InspectionPhotoGallery } from '../InspectionPhotoGallery';

jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('@expo/vector-icons', () => ({ Feather: () => null }));
jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.setTimeout(15000);

describe('inspection evidence gallery', () => {
  afterEach(() => jest.restoreAllMocks());
  it('keeps the active two-finger responder through successive zoom updates', () => {
    const create = jest.spyOn(PanResponder, 'create');
    render(<InspectionPhotoGallery photos={[{ id: 'a', uri: 'file://a.jpg' }]} />);
    fireEvent.press(screen.getByLabelText('Visualizar foto 1'));
    const calls = create.mock.calls.length;
    const handler = create.mock.calls[calls - 1][0];
    const event = (distance: number) => ({ nativeEvent: { touches: [{ pageX: 0, pageY: 0 }, { pageX: distance, pageY: 0 }] } } as any);
    const gesture = { dx: 0, dy: 0 } as any;
    act(() => handler.onPanResponderGrant!(event(100), gesture));
    act(() => handler.onPanResponderMove!(event(150), gesture));
    expect(screen.getByText('150%')).toBeTruthy();
    expect(create).toHaveBeenCalledTimes(calls);
    act(() => handler.onPanResponderMove!(event(220), gesture));
    expect(screen.getByText('220%')).toBeTruthy();
    create.mockRestore();
  });
  it('opens a photo for inspection, zooms and closes without calling replacement', () => {
    const onReplace = jest.fn();
    render(<InspectionPhotoGallery photos={[{ id: 'a', uri: 'file://a.jpg' }]} onReplace={onReplace} />);
    fireEvent.press(screen.getByLabelText('Visualizar foto 1'));
    expect(screen.getByText('Foto da vistoria')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Aumentar zoom'));
    expect(screen.getByText('150%')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Fechar foto'));
    expect(screen.queryByText('Foto da vistoria')).toBeNull();
    expect(onReplace).not.toHaveBeenCalled();
  });

  it('keeps explicit actions separate and passes stable image identity', () => {
    const onRemove = jest.fn(), onReplace = jest.fn(), onAdd = jest.fn();
    render(<InspectionPhotoGallery photos={[{ id: 'stable-id', uri: 'file://a.jpg' }]} onRemove={onRemove} onReplace={onReplace} onAdd={onAdd} />);
    fireEvent.press(screen.getByLabelText('Substituir foto 1'));
    expect(onReplace).toHaveBeenCalledWith('stable-id');
    expect(onRemove).not.toHaveBeenCalled();
    fireEvent.press(screen.getByLabelText('Remover foto 1'));
    expect(onRemove).toHaveBeenCalledWith('stable-id');
    fireEvent.press(screen.getByLabelText('Adicionar foto'));
    expect(onAdd).toHaveBeenCalledTimes(1);
  });

  it('honors the inspection-wide limit and blocks mutation while capture is running', () => {
    const onRemove = jest.fn(), onReplace = jest.fn();
    render(<InspectionPhotoGallery photos={[{ id: 'a', uri: 'file://a.jpg' }]} totalCount={3} busy onRemove={onRemove} onReplace={onReplace} onAdd={jest.fn()} />);
    expect(screen.queryByLabelText('Adicionar foto')).toBeNull();
    fireEvent.press(screen.getByLabelText('Remover foto 1'));
    fireEvent.press(screen.getByLabelText('Substituir foto 1'));
    expect(onRemove).not.toHaveBeenCalled();
    expect(onReplace).not.toHaveBeenCalled();
  });
});
