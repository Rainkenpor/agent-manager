<script setup lang="ts">
import { computed } from 'vue'
import { useAuthStore } from '@/store/useAuth'
import { RouterLink, useRouter } from 'vue-router'

const auth = useAuthStore()
const router = useRouter()

function logout() {
  auth.logout()
  router.push('/login')
}

const allSections = [
  {
    to: '/users',
    resource: 'users',
    label: 'Usuarios',
    description:
      'Gestiona las cuentas del equipo, asigna roles y controla el acceso. La autenticación se realiza mediante JWT y el flujo OAuth 2.0 con PKCE para clientes MCP.',
    gradient: 'from-indigo-500 to-blue-600',
    glow: 'shadow-indigo-500/20',
    badge: 'bg-indigo-500/10 text-indigo-400 ring-1 ring-indigo-500/20',
    icon: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />`,
  },
  {
    to: '/roles',
    resource: 'roles',
    label: 'Roles y Permisos',
    description:
      'Controla qué puede hacer cada usuario. Los roles agrupan permisos por recurso y acción, y determinan qué agentes y servidores MCP tiene disponibles cada miembro del equipo.',
    gradient: 'from-violet-500 to-purple-600',
    glow: 'shadow-violet-500/20',
    badge: 'bg-violet-500/10 text-violet-400 ring-1 ring-violet-500/20',
    icon: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />`,
  },
  {
    to: '/agents',
    resource: 'agents',
    label: 'AI Agents',
    description:
      'Define agents en formato markdown. Cada agente puede operar en modo primario o como subagente, con herramientas asignadas y acceso a servidores MCP. Son el núcleo de ejecución del sistema.',
    gradient: 'from-emerald-500 to-teal-600',
    glow: 'shadow-emerald-500/20',
    badge: 'bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20',
    icon: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17H3a2 2 0 01-2-2V5a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2h-2" />`,
  },
  {
    to: '/mcps',
    resource: 'mcp_servers',
    label: 'MCP Servers',
    description:
      'Registra y administra servidores MCP externos (HTTP o stdio). Cada servidor expone herramientas que los agentes pueden utilizar. Este proyecto también levanta su propio endpoint MCP en el puerto 3201.',
    gradient: 'from-amber-500 to-orange-600',
    glow: 'shadow-amber-500/20',
    badge: 'bg-amber-500/10 text-amber-400 ring-1 ring-amber-500/20',
    icon: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />`,
  }
]

const sections = computed(() =>
  allSections.filter((s) => auth.hasResourceAccess(s.resource))
)

const architecture = [
  { label: 'Routes', desc: 'Validación de entrada con Zod' },
  { label: 'Use Cases', desc: 'Lógica de negocio (CQRS)' },
  { label: 'Domain', desc: 'Entidades e interfaces' },
  { label: 'Infra', desc: 'Drizzle ORM · Passport · MCP' },
]
</script>

<template>
  <div class="min-h-full bg-slate-950 text-white">

    <!-- ── Hero ─────────────────────────────────────────────────── -->
    <div class="relative overflow-hidden border-b border-slate-800/60">
      <div class="pointer-events-none absolute inset-0">
        <div class="absolute -top-32 -left-32 w-[480px] h-[480px] rounded-full bg-indigo-600/15 blur-[120px]" />
        <div class="absolute top-10 right-0 w-[300px] h-[300px] rounded-full bg-violet-600/10 blur-[100px]" />
      </div>
      <div class="pointer-events-none absolute inset-0 opacity-[0.03]"
        style="background-image: radial-gradient(circle, #fff 1px, transparent 1px); background-size: 28px 28px;" />

      <div class="relative max-w-6xl mx-auto px-8 py-14 flex flex-col lg:flex-row items-center gap-14">

        <!-- Text -->
        <div class="flex-1 min-w-0">
          <p class="text-xs font-semibold tracking-widest uppercase text-slate-500 mb-4">
            Plataforma interna
          </p>
          <h1 class="text-4xl font-extrabold leading-tight tracking-tight mb-4">
            <span class="text-white">Hola, </span>
            <span class="bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent">
              {{ auth.user?.firstName || auth.user?.username || 'usuario' }}
            </span>
          </h1>
          <p class="text-slate-400 text-base leading-relaxed max-w-lg mb-6">
            <strong class="text-slate-200">Agent Manager</strong> es la herramienta interna para administrar
            agentes de IA, servidores MCP, usuarios y control de acceso basado en roles.
            Desde aquí puedes configurar qué herramientas tienen disponibles los agentes y
            qué puede hacer cada miembro del equipo al conectarse vía el protocolo MCP.
          </p>

          <!-- MCP endpoint pill + logout -->
          <div class="flex flex-wrap items-center gap-3">
            <div
              class="inline-flex items-center gap-3 px-4 py-2.5 rounded-xl border border-slate-700/70 bg-slate-900/60 text-sm">
              <span class="flex items-center gap-1.5">
                <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span class="text-slate-400 text-xs">MCP endpoint</span>
              </span>
              <code class="text-indigo-300 text-xs font-mono">localhost:3201/mcp</code>
              <span class="w-px h-3.5 bg-slate-700" />
              <span class="text-slate-400 text-xs">API</span>
              <code class="text-indigo-300 text-xs font-mono">localhost:3200/api</code>
            </div>
            <button
              class="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-700 hover:border-red-500/50 bg-slate-900/60 hover:bg-red-500/10 text-slate-400 hover:text-red-400 text-sm font-medium transition-all duration-150"
              @click="logout">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Cerrar sesión
            </button>
          </div>
        </div>

        <!-- SVG -->
        <div class="shrink-0 w-64 h-64 lg:w-72 lg:h-72">
          <svg viewBox="0 0 320 320" fill="none" xmlns="http://www.w3.org/2000/svg" class="w-full h-full">
            <defs>
              <filter id="glow-core" x="-60%" y="-60%" width="220%" height="220%">
                <feGaussianBlur stdDeviation="8" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
              <filter id="glow-node" x="-80%" y="-80%" width="260%" height="260%">
                <feGaussianBlur stdDeviation="5" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
              <filter id="glow-line" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="2" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
              <radialGradient id="grad-core" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stop-color="#818cf8" />
                <stop offset="100%" stop-color="#4f46e5" />
              </radialGradient>
              <radialGradient id="grad-users" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stop-color="#60a5fa" />
                <stop offset="100%" stop-color="#2563eb" />
              </radialGradient>
              <radialGradient id="grad-roles" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stop-color="#c084fc" />
                <stop offset="100%" stop-color="#7c3aed" />
              </radialGradient>
              <radialGradient id="grad-agents" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stop-color="#34d399" />
                <stop offset="100%" stop-color="#059669" />
              </radialGradient>
              <radialGradient id="grad-mcp" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stop-color="#fbbf24" />
                <stop offset="100%" stop-color="#d97706" />
              </radialGradient>
              <radialGradient id="grad-auth" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stop-color="#f472b6" />
                <stop offset="100%" stop-color="#db2777" />
              </radialGradient>
              <linearGradient id="line-indigo" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="#6366f1" stop-opacity="0.6" />
                <stop offset="100%" stop-color="#4f46e5" stop-opacity="0.1" />
              </linearGradient>
              <path id="orb1" d="M160,64 A96,96 0 1,1 159.9,64" fill="none" />
              <path id="orb2" d="M160,100 A60,60 0 1,0 159.9,100" fill="none" />
            </defs>

            <circle cx="160" cy="160" r="130" stroke="#ffffff" stroke-width="0.5" stroke-opacity="0.04" />
            <circle cx="160" cy="160" r="96" stroke="#6366f1" stroke-width="0.8" stroke-opacity="0.12"
              stroke-dasharray="4 6">
              <animateTransform attributeName="transform" type="rotate" from="0 160 160" to="360 160 160" dur="30s"
                repeatCount="indefinite" />
            </circle>
            <circle cx="160" cy="160" r="60" stroke="#818cf8" stroke-width="0.8" stroke-opacity="0.18"
              stroke-dasharray="3 5">
              <animateTransform attributeName="transform" type="rotate" from="360 160 160" to="0 160 160" dur="20s"
                repeatCount="indefinite" />
            </circle>

            <line x1="160" y1="160" x2="85" y2="75" stroke="url(#line-indigo)" stroke-width="1.5"
              filter="url(#glow-line)" stroke-dasharray="5 4">
              <animate attributeName="stroke-dashoffset" values="0;-18" dur="2.8s" repeatCount="indefinite" />
              <animate attributeName="stroke-opacity" values="0.7;1;0.7" dur="2.8s" repeatCount="indefinite" />
            </line>
            <line x1="160" y1="160" x2="240" y2="75" stroke="#7c3aed" stroke-width="1.5" filter="url(#glow-line)"
              stroke-dasharray="5 4" stroke-opacity="0.6">
              <animate attributeName="stroke-dashoffset" values="0;18" dur="3.2s" repeatCount="indefinite" />
              <animate attributeName="stroke-opacity" values="0.6;1;0.6" dur="3.2s" repeatCount="indefinite" />
            </line>
            <line x1="160" y1="160" x2="72" y2="240" stroke="#059669" stroke-width="1.5" filter="url(#glow-line)"
              stroke-dasharray="5 4" stroke-opacity="0.6">
              <animate attributeName="stroke-dashoffset" values="0;-18" dur="3.6s" repeatCount="indefinite" />
              <animate attributeName="stroke-opacity" values="0.6;1;0.6" dur="3.6s" repeatCount="indefinite" />
            </line>
            <line x1="160" y1="160" x2="248" y2="240" stroke="#d97706" stroke-width="1.5" filter="url(#glow-line)"
              stroke-dasharray="5 4" stroke-opacity="0.6">
              <animate attributeName="stroke-dashoffset" values="0;18" dur="2.4s" repeatCount="indefinite" />
              <animate attributeName="stroke-opacity" values="0.6;1;0.6" dur="2.4s" repeatCount="indefinite" />
            </line>
            <line x1="160" y1="160" x2="262" y2="160" stroke="#db2777" stroke-width="1.5" filter="url(#glow-line)"
              stroke-dasharray="5 4" stroke-opacity="0.6">
              <animate attributeName="stroke-dashoffset" values="0;-18" dur="4s" repeatCount="indefinite" />
              <animate attributeName="stroke-opacity" values="0.6;1;0.6" dur="4s" repeatCount="indefinite" />
            </line>
            <line x1="85" y1="75" x2="240" y2="75" stroke="#4f46e5" stroke-width="0.8" stroke-opacity="0.15"
              stroke-dasharray="3 5">
              <animate attributeName="stroke-opacity" values="0.08;0.25;0.08" dur="5s" repeatCount="indefinite" />
            </line>
            <line x1="72" y1="240" x2="248" y2="240" stroke="#059669" stroke-width="0.8" stroke-opacity="0.15"
              stroke-dasharray="3 5">
              <animate attributeName="stroke-opacity" values="0.08;0.25;0.08" dur="6s" repeatCount="indefinite" />
            </line>

            <circle r="3" fill="#818cf8" filter="url(#glow-node)">
              <animateMotion dur="4s" repeatCount="indefinite">
                <mpath href="#orb1" />
              </animateMotion>
            </circle>
            <circle r="2.5" fill="#34d399" filter="url(#glow-node)" opacity="0.8">
              <animateMotion dur="7s" repeatCount="indefinite" keyPoints="1;0" keyTimes="0;1" calcMode="linear">
                <mpath href="#orb2" />
              </animateMotion>
            </circle>
            <circle r="2" fill="#fbbf24" opacity="0.9">
              <animateMotion dur="5.5s" begin="1.5s" repeatCount="indefinite">
                <mpath href="#orb1" />
              </animateMotion>
            </circle>

            <g filter="url(#glow-node)">
              <circle cx="85" cy="75" r="22" fill="#1e1b4b" stroke="#3730a3" stroke-width="1" />
              <circle cx="85" cy="75" r="22" fill="url(#grad-users)" opacity="0.15" />
              <circle cx="85" cy="75" r="22" fill="transparent" stroke="#60a5fa" stroke-width="1.5">
                <animate attributeName="r" values="22;28;22" dur="3s" repeatCount="indefinite" />
                <animate attributeName="stroke-opacity" values="0.8;0;0.8" dur="3s" repeatCount="indefinite" />
              </circle>
              <circle cx="85" cy="75" r="14" fill="url(#grad-users)" opacity="0.9" />
              <text x="85" y="79" text-anchor="middle" font-size="10" font-weight="800" fill="white"
                font-family="system-ui">USR</text>
            </g>

            <g filter="url(#glow-node)">
              <circle cx="240" cy="75" r="22" fill="#1e1b4b" stroke="#6d28d9" stroke-width="1" />
              <circle cx="240" cy="75" r="22" fill="url(#grad-roles)" opacity="0.15" />
              <circle cx="240" cy="75" r="22" fill="transparent" stroke="#c084fc" stroke-width="1.5">
                <animate attributeName="r" values="22;28;22" dur="3.4s" repeatCount="indefinite" />
                <animate attributeName="stroke-opacity" values="0.8;0;0.8" dur="3.4s" repeatCount="indefinite" />
              </circle>
              <circle cx="240" cy="75" r="14" fill="url(#grad-roles)" opacity="0.9" />
              <text x="240" y="79" text-anchor="middle" font-size="10" font-weight="800" fill="white"
                font-family="system-ui">ROL</text>
            </g>

            <g filter="url(#glow-node)">
              <circle cx="72" cy="240" r="22" fill="#052e16" stroke="#065f46" stroke-width="1" />
              <circle cx="72" cy="240" r="22" fill="url(#grad-agents)" opacity="0.15" />
              <circle cx="72" cy="240" r="22" fill="transparent" stroke="#34d399" stroke-width="1.5">
                <animate attributeName="r" values="22;28;22" dur="2.8s" repeatCount="indefinite" />
                <animate attributeName="stroke-opacity" values="0.8;0;0.8" dur="2.8s" repeatCount="indefinite" />
              </circle>
              <circle cx="72" cy="240" r="14" fill="url(#grad-agents)" opacity="0.9" />
              <text x="72" y="244" text-anchor="middle" font-size="10" font-weight="800" fill="white"
                font-family="system-ui">AGT</text>
            </g>

            <g filter="url(#glow-node)">
              <circle cx="248" cy="240" r="22" fill="#1c1007" stroke="#92400e" stroke-width="1" />
              <circle cx="248" cy="240" r="22" fill="url(#grad-mcp)" opacity="0.15" />
              <circle cx="248" cy="240" r="22" fill="transparent" stroke="#fbbf24" stroke-width="1.5">
                <animate attributeName="r" values="22;28;22" dur="3.2s" repeatCount="indefinite" />
                <animate attributeName="stroke-opacity" values="0.8;0;0.8" dur="3.2s" repeatCount="indefinite" />
              </circle>
              <circle cx="248" cy="240" r="14" fill="url(#grad-mcp)" opacity="0.9" />
              <text x="248" y="244" text-anchor="middle" font-size="9" font-weight="800" fill="white"
                font-family="system-ui">MCP</text>
            </g>

            <g filter="url(#glow-node)">
              <circle cx="262" cy="160" r="18" fill="#1a0a12" stroke="#9d174d" stroke-width="1" />
              <circle cx="262" cy="160" r="18" fill="url(#grad-auth)" opacity="0.15" />
              <circle cx="262" cy="160" r="18" fill="transparent" stroke="#f472b6" stroke-width="1.5">
                <animate attributeName="r" values="18;24;18" dur="4s" repeatCount="indefinite" />
                <animate attributeName="stroke-opacity" values="0.8;0;0.8" dur="4s" repeatCount="indefinite" />
              </circle>
              <circle cx="262" cy="160" r="11" fill="url(#grad-auth)" opacity="0.85" />
              <text x="262" y="164" text-anchor="middle" font-size="8" font-weight="800" fill="white"
                font-family="system-ui">JWT</text>
            </g>

            <g filter="url(#glow-core)">
              <circle cx="160" cy="160" r="40" fill="transparent" stroke="#6366f1" stroke-width="1.5">
                <animate attributeName="r" values="40;54;40" dur="3s" repeatCount="indefinite" />
                <animate attributeName="stroke-opacity" values="0.6;0;0.6" dur="3s" repeatCount="indefinite" />
              </circle>
              <circle cx="160" cy="160" r="40" fill="transparent" stroke="#818cf8" stroke-width="1">
                <animate attributeName="r" values="40;62;40" dur="3s" begin="0.6s" repeatCount="indefinite" />
                <animate attributeName="stroke-opacity" values="0.4;0;0.4" dur="3s" begin="0.6s"
                  repeatCount="indefinite" />
              </circle>
              <circle cx="160" cy="160" r="40" fill="#0f0d1e" stroke="#4f46e5" stroke-width="1.5" />
              <circle cx="160" cy="160" r="36" fill="url(#grad-core)" opacity="0.25" />
              <circle cx="160" cy="160" r="28" fill="url(#grad-core)" opacity="0.5" />
              <circle cx="160" cy="160" r="20" fill="url(#grad-core)" />
            </g>
            <text x="160" y="155" text-anchor="middle" font-size="9" font-weight="800" fill="white"
              font-family="system-ui" letter-spacing="1">AGENT</text>
            <text x="160" y="167" text-anchor="middle" font-size="9" font-weight="800" fill="#c7d2fe"
              font-family="system-ui" letter-spacing="1">MGR</text>
          </svg>
        </div>
      </div>
    </div>

    <!-- ── Purpose strip ─────────────────────────────────────────── -->
    <div class="border-b border-slate-800/60">
      <div class="max-w-6xl mx-auto px-8 py-8">
        <p class="text-xs font-semibold tracking-widest uppercase text-slate-600 mb-5">¿Para qué sirve?</p>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div class="flex gap-3 items-start">
            <div class="mt-0.5 w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center shrink-0">
              <svg class="w-4 h-4 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                  d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div>
              <p class="text-sm font-semibold text-slate-200 mb-1">Orquestación de agentes</p>
              <p class="text-xs text-slate-500 leading-relaxed">
                Centraliza la creación y configuración de agentes de IA. Define su comportamiento, modo de ejecución y
                las herramientas a las que tienen acceso.
              </p>
            </div>
          </div>
          <div class="flex gap-3 items-start">
            <div class="mt-0.5 w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
              <svg class="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                  d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <p class="text-sm font-semibold text-slate-200 mb-1">Protocolo MCP</p>
              <p class="text-xs text-slate-500 leading-relaxed">
                Expone un servidor MCP propio en el puerto 3201. Los clientes externos (como IDEs o herramientas de
                desarrollo) se conectan mediante OAuth 2.0 con PKCE.
              </p>
            </div>
          </div>
          <div class="flex gap-3 items-start">
            <div class="mt-0.5 w-8 h-8 rounded-lg bg-violet-500/10 flex items-center justify-center shrink-0">
              <svg class="w-4 h-4 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <div>
              <p class="text-sm font-semibold text-slate-200 mb-1">Control de acceso</p>
              <p class="text-xs text-slate-500 leading-relaxed">
                Cada usuario tiene roles que determinan sus permisos, qué agentes puede utilizar y qué servidores MCP
                tiene disponibles al conectarse.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ── Module cards ───────────────────────────────────────────── -->
    <div v-if="sections.length > 0" class="max-w-6xl mx-auto px-8 py-12">
      <p class="text-xs font-semibold tracking-widest uppercase text-slate-600 mb-6">Módulos</p>
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <RouterLink v-for="s in sections" :key="s.to" :to="s.to"
          class="group relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/50 p-5 flex flex-col gap-4 transition-all duration-200 hover:border-slate-700 hover:bg-slate-800/60 hover:-translate-y-0.5"
          :class="`hover:shadow-lg ${s.glow}`">
          <div class="absolute inset-x-0 top-0 h-px opacity-0 group-hover:opacity-100 transition-opacity duration-300"
            :class="`bg-gradient-to-r ${s.gradient}`" />
          <div class="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            :class="`bg-gradient-to-br ${s.gradient}`">
            <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" v-html="s.icon" />
          </div>
          <div class="flex-1">
            <h3 class="text-sm font-semibold text-white mb-1.5">{{ s.label }}</h3>
            <p class="text-xs text-slate-500 leading-relaxed">{{ s.description }}</p>
          </div>
          <div class="flex items-center justify-between">
            <span class="text-xs font-medium px-2.5 py-1 rounded-full" :class="s.badge">Abrir</span>
            <svg
              class="w-4 h-4 text-slate-600 group-hover:text-slate-400 group-hover:translate-x-0.5 transition-all duration-150"
              fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </RouterLink>
      </div>
    </div>
  </div>
</template>
