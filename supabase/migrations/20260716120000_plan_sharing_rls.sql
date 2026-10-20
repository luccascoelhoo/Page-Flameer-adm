-- D2 — Compartilhamento de planos (ver treino/dieta de outros atletas)
--
-- Hoje o SELECT de public.workouts e public.diets exige is_template = true,
-- creator_id = auth.uid() ou challenge_id IS NOT NULL — então NÃO dá pra ver o
-- plano PESSOAL de outro usuário. As sub-tabelas (exercises, exercise_sets,
-- workout_days, meals, meal_items) já são legíveis por todos.
--
-- Esta migration abre o SELECT das tabelas-pai para qualquer usuário
-- autenticado, permitindo visitar o perfil de outro atleta e ver o plano dele
-- (base pro recurso de copiar).
--
-- ⚠️ SEGURANÇA: isto expõe o CONTEÚDO do plano via API. O gate "free vê que
-- existe mas não copia" é enforced NO APP por enquanto — um usuário técnico
-- consegue ler o conteúdo direto pela API. Refinar depois (ex.: coluna
-- profiles.is_public por perfil, ou expor só metadados para quem é free).
--
-- Escrita continua restrita ao dono (as policies FOR ALL por creator_id ficam).

drop policy if exists "Athletes can view other athletes workouts" on public.workouts;
create policy "Athletes can view other athletes workouts"
    on public.workouts for select
    to authenticated
    using (true);

drop policy if exists "Athletes can view other athletes diets" on public.diets;
create policy "Athletes can view other athletes diets"
    on public.diets for select
    to authenticated
    using (true);
