import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { InspectionMetadata } from '../InspectionMetadata';
it('shows the agent, collection time and server protocol', () => {
  const date = '2026-11-12T13:45:00Z';
  render(<InspectionMetadata agent="Pedro" date={date} protocol="TCS-IND-2026-000030" id="inspection-1" color="#000" />);
  expect(screen.getByText(/Pedro/).props.children.join('')).toContain(new Date(date).toLocaleString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }));
  expect(screen.getByText('Protocolo: TCS-IND-2026-000030')).toBeTruthy();
});
it('labels the local identifier without inventing an official protocol', () => {
  render(<InspectionMetadata agent="Pedro" date="" protocol={null} id="local-1" color="#000" />);
  expect(screen.getByText('Registro local: local-1')).toBeTruthy();
  expect(screen.queryByText(/Protocolo:/)).toBeNull();
});
