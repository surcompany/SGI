# SGI - Sistema de Gestión Integral

SGI es una aplicación web para gestionar, registrar y analizar indicadores de desempeño de procesos empresariales. El proyecto combina un frontend moderno en React con un backend en Express y una capa de datos en Supabase para centralizar el seguimiento operativo y facilitar la toma de decisiones.

## Qué hace el sistema

SGI permite controlar la operación diaria de una organización a través de indicadores claros, metas medibles y seguimiento continuo. En la práctica, el sistema sirve para:

- Registrar resultados de indicadores por proceso y por periodo.
- Medir si cada indicador cumple o no con su meta.
- Visualizar el estado de cumplimiento con semáforos verde, amarillo y rojo.
- Consultar históricos y tendencias de desempeño a lo largo del tiempo.
- Administrar procesos, indicadores y usuarios desde un panel centralizado.
- Adjuntar evidencias documentales en formato PDF.
- Diferenciar accesos según el rol del usuario.

## Funcionalidades destacadas

### 1. Gestión de indicadores
- Crear, editar y eliminar indicadores.
- Asignar cada indicador a un proceso específico.
- Definir meta, unidad de medida, frecuencia, fórmula de cálculo y umbrales del semáforo.
- Activar o desactivar indicadores según su estado.

### 2. Registro operativo
- Ingresar resultados mensuales o periódicos para cada indicador.
- Escribir análisis de causas y plan de acción.
- Guardar registros como borrador o enviarlos oficialmente.
- Adjuntar evidencia documental en PDF.

### 3. Monitoreo y tablero ejecutivo
- Ver un dashboard general con el cumplimiento por proceso.
- Identificar procesos que cumplen, que están en riesgo o que no cumplen.
- Consultar métricas consolidadas de forma visual.

### 4. Histórico y trazabilidad
- Revisar registros anteriores por periodo y por indicador.
- Filtrar por proceso, indicador, frecuencia y rango de fechas.
- Comparar tendencias para analizar evolución y desempeño.
- Ver datos de quien registró la información y su evidencia asociada.

### 5. Administración del sistema
- Crear y administrar usuarios.
- Asignar roles como Administrador o Líder de Proceso.
- Vincular usuarios a procesos específicos.
- Gestionar indicadores y permisos desde un mismo entorno.

## Pantallas principales

- Login: acceso seguro al sistema.
- Dashboard: resumen ejecutivo del cumplimiento.
- Matriz de Indicadores: catálogo completo con descripción y configuración.
- Registrar Indicador: formulario para ingresar resultados y planes de acción.
- Histórico: visualización de registros anteriores y tendencias.
- Procesos: vista jerárquica y consolidada por proceso empresarial.
- Configuración: administración de usuarios e indicadores.

## Arquitectura general

El proyecto está dividido en tres capas principales:

1. Frontend
   - Construido con React, TypeScript, Vite y React Router.
   - Maneja la interfaz de usuario, navegación, formularios, gráficos y estados de autenticación.
   - Usa hooks y servicios para consumir datos de forma organizada.

2. Backend
   - Implementado con Node.js + Express + TypeScript.
   - Expone endpoints REST bajo /api para usuarios e indicadores.
   - Valida tokens JWT de Supabase y restringe acciones por rol.

3. Base de datos y autenticación
   - Supabase se usa como motor de datos y autenticación.
   - Los registros se almacenan en tablas como procesos, indicadores, profiles y registro_mensual_indicadores.
   - El almacenamiento de evidencias se maneja desde Supabase Storage.

## Flujo de funcionamiento

### 1. Inicio de sesión
- El usuario ingresa con Supabase Auth.
- El contexto de autenticación carga la sesión y el perfil del usuario.
- El sistema determina el rol y el proceso asociado para mostrar las pantallas adecuadas.

### 2. Carga de datos
- Las páginas del frontend consumen hooks como useIndicadores, useProcesos y useRegistros.
- Estos hooks llaman a servicios que consultan información desde Supabase o desde el backend.
- El backend usa Supabase Admin para acceder a datos protegidos y responder a las solicitudes del frontend.

### 3. Registro de indicadores
- Un líder puede seleccionar un indicador, definir un periodo y registrar un resultado mensual.
- El sistema calcula automáticamente el cumplimiento, el semáforo y el porcentaje de cumplimiento.
- El registro puede guardarse como borrador o enviarse formalmente.

### 4. Gestión y visualización
- El administrador puede ver una visión consolidada del cumplimiento general.
- El líder puede ver su propio panorama según el proceso asignado.
- El historial permite filtrar por proceso, indicador, frecuencia y rango de fechas.

## Funcionalidades principales

### Panel de autenticación y permisos
- Login seguro con Supabase.
- Gestión de sesión persistente.
- Protección de rutas según rol.
- Administradores tienen acceso a gestión de usuarios e indicadores.

### Dashboard ejecutivo
- Vista general del cumplimiento por proceso.
- Indicadores clave y métricas consolidadas.
- Gráficos de barras y pastel para monitorear desempeño.
- Semaforización visual por estado de cumplimiento.

### Matriz de indicadores
- Listado completo de indicadores con su descripción, meta, fórmula, frecuencia y umbral de semaforización.
- Filtros por proceso y búsqueda por nombre o código.

### Registro de indicadores
- Formulario para registrar resultados mensuales.
- Cálculo automático de cumplimiento y semáforo.
- Guardado de borradores.
- Subida de evidencia en PDF.

### Histórico
- Consulta de registros anteriores.
- Filtros combinados por proceso, indicador, frecuencia y periodo.
- Vista de tendencias y comparación entre periodos.
- Posibilidad de editar o eliminar registros según permisos.

### Gestión de procesos y usuarios
- Visualización jerárquica de procesos.
- Administración de indicadores desde un panel dedicado.
- Creación, edición y eliminación de usuarios.
- Asignación de proceso y rol.

## Estructura del proyecto

```text
SGI/
├── backend/
│   ├── src/
│   │   ├── index.ts
│   │   ├── lib/
│   │   ├── middleware/
│   │   └── routes/
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── App.tsx
│   │   ├── context/
│   │   ├── hooks/
│   │   ├── pages/
│   │   ├── services/
│   │   └── utils/
│   └── package.json
├── shared/
│   ├── constants
│   ├── dtos
│   └── types
└── package.json
```

## Tecnologías utilizadas

### Frontend
- React 18
- TypeScript
- Vite
- React Router DOM
- Recharts
- Lucide React
- SweetAlert2

### Backend
- Node.js
- Express
- TypeScript
- Supabase JS
- CORS
- dotenv

### Infraestructura y datos
- Supabase Auth
- Supabase Database
- Supabase Storage
- Variables de entorno para configuración segura

## Variables de entorno

### Frontend
```env
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_API_URL=http://localhost:3001/api
```

### Backend
```env
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
PORT=3001
ALLOWED_ORIGINS=http://localhost:3000,http://192.168.2.57:3000
```

## Cómo ejecutar el proyecto

Desde la raíz del proyecto:

```bash
npm install
npm run dev
```

Esto levanta:
- el frontend en Vite
- el backend en Express

También puedes correrlos por separado:

```bash
npm run dev:frontend
npm run dev:backend
```

## Roles del sistema

- Administrador
  - Ve el panorama completo.
  - Gestiona usuarios e indicadores.
  - Puede consultar todo el historial.

- Líder de Proceso
  - Registra resultados de sus indicadores.
  - Visualiza su vista específica por proceso.
  - Puede trabajar con borradores y registros asociados a su área.

## Resumen

SGI centraliza la gestión de indicadores de proceso en una sola herramienta, reduce el trabajo manual, mejora la trazabilidad de los registros y facilita la supervisión del cumplimiento operativo desde una interfaz clara y organizada.
