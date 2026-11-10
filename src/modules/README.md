# src/modules

Lógica de dominio de Loyili, una carpeta por módulo. Las pantallas (`src/app/`) llaman a estas funciones; aquí no hay JSX de páginas.

Estructura de cada módulo (se crea cuando se implementa):

```
<modulo>/
  index.ts      # lo que el módulo expone a los demás (API pública del módulo)
  schemas.ts    # validación de datos con Zod
  queries.ts    # lecturas de la base de datos
  actions.ts    # Server Actions: escrituras ("use server")
  types.ts      # tipos TypeScript del módulo
```

Módulos previstos: `auth`, `merchants`, `programs`, `customers`, `ledger`, `rewards`, `redemptions`, `identification`.

Regla: un módulo no importa archivos internos de otro; solo lo que exporta su `index.ts`.
