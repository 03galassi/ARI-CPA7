# ARI-CPA7

Primeira base do aplicativo web para controle de atividades.

## Estrutura
- `index.html` — interface de login, operador e administrador.
- `styles.css` — visual responsivo.
- `app.js` — autenticação e operações.
- `schema.sql` — banco Supabase com RLS.

## Regras implementadas
- Login por CPF.
- CPF validado.
- Senha exatamente com 6 dígitos numéricos.
- Perfil `operator` ou `admin`.
- Operador consulta e edita somente atividades próprias.
- `owner_id` é definido pelo banco através de `auth.uid()`.
- RLS impede acesso cruzado entre usuários.
- Recuperação de senha usa o e-mail associado à conta.

## Configuração
1. Criar um projeto Supabase.
2. Executar `schema.sql` no SQL Editor.
3. Criar os usuários no Supabase Auth e seus registros em `profiles`.
4. Em `app.js`, preencher `SUPABASE_URL` e `SUPABASE_ANON_KEY`.
5. Publicar os arquivos em GitHub Pages, Netlify ou outro host HTTPS.

## Atenção de segurança
Esta base é um protótipo técnico. Por envolver informações potencialmente sensíveis de atividade de inteligência, a implantação em produção deve ser submetida às regras e à infraestrutura autorizadas pela instituição. Não coloque a chave `service_role` do Supabase no navegador.

## Acesso de campo — teste local
CPF de teste: `11122233344` / senha: `123456`. Este acesso é somente para demonstração e deve ser substituído por usuários reais no banco.

E-mail de recuperação configurado: `cpa7.fb@gmail.com`.

## Equipe de campo
Interface responsiva para lançamento de saída, viatura, KM, destino, descrição, informação obtida e retorno. O operador consulta e edita somente seus próprios registros.

## Municípios
O campo de saída/destino usa os 38 municípios da Mesorregião Sudoeste de Mato Grosso do Sul conforme a classificação geográfica consultada. A lista foi incorporada ao protótipo.
