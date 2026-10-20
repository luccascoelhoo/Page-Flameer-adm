-- Base nutricional de alimentos (fonte: TACO — Tabela Brasileira de Composição
-- de Alimentos, NEPA/UNICAMP). Valores por 100g de porção comestível.
--
-- Motivação: até aqui os `meal_items` eram só texto (name + quantity), sem
-- nenhum dado nutricional — o app não sabia quantas calorias tem "Peito de
-- Frango 150g". Por isso o "trocar alimento" era mockado (3 opções fixas). Esta
-- tabela dá uma base REAL e citável para substituições equivalentes e para os
-- macros por item.
--
-- A SEED com os valores vai numa migration separada (20260718100001) para manter
-- este schema limpo e a curadoria de dados isolada.

CREATE TABLE IF NOT EXISTS public.foods (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name       TEXT NOT NULL,
    category   TEXT NOT NULL,              -- 'Proteína', 'Carboidrato', 'Fruta', ...
    -- valores POR 100g de porção comestível.
    -- double precision (não DECIMAL) de propósito: o PostgREST serializa numeric
    -- como string pra não perder precisão, e o decode do app espera Double/número.
    kcal       DOUBLE PRECISION NOT NULL,
    protein    DOUBLE PRECISION NOT NULL DEFAULT 0, -- g / 100g
    carbs      DOUBLE PRECISION NOT NULL DEFAULT 0, -- g / 100g
    fat        DOUBLE PRECISION NOT NULL DEFAULT 0, -- g / 100g
    -- rastreabilidade: de onde veio o número (TACO, USDA, rótulo médio…)
    source     TEXT NOT NULL DEFAULT 'TACO',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (name)
);

-- Busca por categoria alimenta o "trocar alimento" (substitutos da mesma família).
CREATE INDEX IF NOT EXISTS idx_foods_category ON public.foods(category);
-- Busca por proximidade calórica dentro da categoria.
CREATE INDEX IF NOT EXISTS idx_foods_category_kcal ON public.foods(category, kcal);

ALTER TABLE public.foods ENABLE ROW LEVEL SECURITY;

-- Base pública: qualquer usuário autenticado lê (é catálogo, não dado pessoal).
-- Escrita fica só para admin/seed (sem policy de INSERT aqui).
DROP POLICY IF EXISTS "Foods are readable by everyone" ON public.foods;
CREATE POLICY "Foods are readable by everyone"
    ON public.foods FOR SELECT
    TO authenticated
    USING (true);

-- Liga um item de refeição a um alimento real + a quantidade em GRAMAS, para
-- macros precisos. Aditivo e opcional: o `quantity` (texto livre) continua
-- existindo; quando food_id + grams estão preenchidos, o app calcula os macros
-- reais como foods.<macro> * grams / 100.
ALTER TABLE public.meal_items ADD COLUMN IF NOT EXISTS food_id UUID REFERENCES public.foods(id) ON DELETE SET NULL;
ALTER TABLE public.meal_items ADD COLUMN IF NOT EXISTS grams   DOUBLE PRECISION;
