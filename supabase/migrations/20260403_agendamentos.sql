-- Tabela de agendamentos de vistorias
CREATE TABLE IF NOT EXISTS agendamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo TEXT NOT NULL,
  endereco TEXT,
  municipio TEXT NOT NULL,
  data_agendada TIMESTAMPTZ NOT NULL,
  criado_por_uid UUID REFERENCES users(uid),
  criado_por_nome TEXT,
  agente_uid UUID REFERENCES users(uid),
  agente_nome TEXT,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  observacoes TEXT,
  status TEXT DEFAULT 'pendente' CHECK (status IN ('pendente','concluido','cancelado')),
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

-- RLS: agentes só veem agendamentos do seu município
ALTER TABLE agendamentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "agentes_veem_municipio" ON agendamentos
  FOR SELECT USING (municipio = (SELECT municipio FROM users WHERE uid = auth.uid()));

CREATE POLICY "admin_gerencia" ON agendamentos
  FOR ALL USING (
    (SELECT role FROM users WHERE uid = auth.uid()) IN ('admin','supervisor','master_admin')
  );
