/**
 * utils/deslizamentoSvgs.ts
 * Catálogo de SVG inline para as opções Q5–Q10 do formulário Vistoria de Risco de Deslizamento.
 * Usado pelo wizard.tsx via SvgXml do react-native-svg.
 */
export const DESL_SVGS: Record<string, string> = {

  /* ── Q5: Trincas ─────────────────────────────────────────────────── */
  desl_trincas_nao: `<svg viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg">
    <rect width="80" height="80" fill="#E8F5E9" rx="8"/>
    <rect x="0" y="55" width="80" height="25" fill="#6D4C41"/>
    <rect x="0" y="48" width="80" height="9" fill="#8BC34A"/>
    <circle cx="60" cy="18" r="12" fill="#4CAF50"/>
    <path d="M53,18 L57,22 L67,12" stroke="white" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    <text x="22" y="44" text-anchor="middle" font-size="7" fill="#2E7D32" font-weight="600">Sem trincas</text>
  </svg>`,

  desl_trincas_sim: `<svg viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg">
    <rect width="80" height="80" fill="#FFEBEE" rx="8"/>
    <rect x="0" y="55" width="80" height="25" fill="#6D4C41"/>
    <rect x="0" y="48" width="80" height="9" fill="#8BC34A"/>
    <path d="M30,48 L36,54 L28,60 L34,66 L40,56 L36,50 L44,48" stroke="#B71C1C" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="60" cy="18" r="12" fill="#EF4444"/>
    <path d="M54,12 L66,24 M66,12 L54,24" stroke="white" stroke-width="3" stroke-linecap="round"/>
    <text x="14" y="44" text-anchor="middle" font-size="7" fill="#B71C1C" font-weight="600">Trincas</text>
  </svg>`,

  /* ── Q6: Degraus de abatimento ────────────────────────────────────── */
  desl_degraus_nao: `<svg viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg">
    <rect width="80" height="80" fill="#E8F5E9" rx="8"/>
    <path d="M0,72 Q40,32 80,22 L80,80 L0,80 Z" fill="#6D4C41"/>
    <path d="M0,70 Q40,30 80,20" stroke="#8BC34A" stroke-width="4" fill="none" stroke-linecap="round"/>
    <circle cx="60" cy="14" r="10" fill="#4CAF50"/>
    <path d="M54,14 L58,18 L66,8" stroke="white" stroke-width="2.5" fill="none" stroke-linecap="round"/>
  </svg>`,

  desl_degraus_sim: `<svg viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg">
    <rect width="80" height="80" fill="#FFEBEE" rx="8"/>
    <path d="M5,78 L5,62 L22,62 L22,50 L42,50 L42,38 L62,38 L62,26 L75,26 L75,80 L5,80 Z" fill="#6D4C41"/>
    <path d="M5,62 L22,62 L22,50 L42,50 L42,38 L62,38 L62,26 L75,26" stroke="#EF4444" stroke-width="2" fill="none"/>
    <circle cx="60" cy="14" r="10" fill="#EF4444"/>
    <path d="M54,8 L66,20 M66,8 L54,20" stroke="white" stroke-width="2.5" stroke-linecap="round"/>
  </svg>`,

  /* ── Q7: Inclinação de estruturas ─────────────────────────────────── */
  desl_incl_est_nao: `<svg viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg">
    <rect width="80" height="80" fill="#E8F5E9" rx="8"/>
    <rect x="0" y="65" width="80" height="15" fill="#6D4C41"/>
    <rect x="37" y="14" width="6" height="53" fill="#78909C" rx="2"/>
    <circle cx="40" cy="10" r="5" fill="#546E7A"/>
    <line x1="10" y1="65" x2="70" y2="65" stroke="#8BC34A" stroke-width="2"/>
    <circle cx="62" cy="14" r="10" fill="#4CAF50"/>
    <path d="M56,14 L60,18 L68,8" stroke="white" stroke-width="2.5" fill="none" stroke-linecap="round"/>
  </svg>`,

  desl_incl_est_sim: `<svg viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg">
    <rect width="80" height="80" fill="#FFEBEE" rx="8"/>
    <rect x="0" y="65" width="80" height="15" fill="#6D4C41"/>
    <rect x="28" y="10" width="6" height="54" fill="#78909C" rx="2" transform="rotate(18 31 65)"/>
    <line x1="10" y1="65" x2="70" y2="65" stroke="#BDBDBD" stroke-width="2"/>
    <circle cx="62" cy="14" r="10" fill="#EF4444"/>
    <path d="M56,8 L68,20 M68,8 L56,20" stroke="white" stroke-width="2.5" stroke-linecap="round"/>
  </svg>`,

  /* ── Q8: Muros embarrigados ───────────────────────────────────────── */
  desl_muros_nao: `<svg viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg">
    <rect width="80" height="80" fill="#E8F5E9" rx="8"/>
    <rect x="0" y="65" width="80" height="15" fill="#6D4C41"/>
    <rect x="12" y="18" width="18" height="48" fill="#CFD8DC" rx="2"/>
    <line x1="12" y1="28" x2="30" y2="28" stroke="#90A4AE" stroke-width="1"/>
    <line x1="12" y1="38" x2="30" y2="38" stroke="#90A4AE" stroke-width="1"/>
    <line x1="12" y1="48" x2="30" y2="48" stroke="#90A4AE" stroke-width="1"/>
    <line x1="12" y1="58" x2="30" y2="58" stroke="#90A4AE" stroke-width="1"/>
    <line x1="21" y1="18" x2="21" y2="65" stroke="#90A4AE" stroke-width="0.5" stroke-dasharray="3,2"/>
    <circle cx="62" cy="18" r="10" fill="#4CAF50"/>
    <path d="M56,18 L60,22 L68,12" stroke="white" stroke-width="2.5" fill="none" stroke-linecap="round"/>
  </svg>`,

  desl_muros_sim: `<svg viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg">
    <rect width="80" height="80" fill="#FFEBEE" rx="8"/>
    <rect x="0" y="65" width="80" height="15" fill="#6D4C41"/>
    <path d="M12,18 C12,28 34,36 34,42 C34,48 12,56 12,65" stroke="#90A4AE" stroke-width="16" fill="none" stroke-linecap="butt"/>
    <path d="M12,18 C12,28 34,36 34,42 C34,48 12,56 12,65" stroke="#CFD8DC" stroke-width="14" fill="none" stroke-linecap="butt"/>
    <path d="M34,42 L46,42" stroke="#EF4444" stroke-width="2.5" stroke-linecap="round"/>
    <path d="M43,38 L48,42 L43,46" stroke="#EF4444" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="62" cy="18" r="10" fill="#EF4444"/>
    <path d="M56,12 L68,24 M68,12 L56,24" stroke="white" stroke-width="2.5" stroke-linecap="round"/>
  </svg>`,

  /* ── Q9: Trinca de escorregamento próxima ─────────────────────────── */
  desl_escorr_sem_risco: `<svg viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg">
    <rect width="80" height="80" fill="#E8F5E9" rx="8"/>
    <path d="M0,78 Q25,42 50,52 Q75,62 80,48 L80,80 L0,80 Z" fill="#6D4C41"/>
    <path d="M0,75 Q25,38 50,48 Q75,58 80,44" stroke="#8BC34A" stroke-width="3" fill="none" stroke-linecap="round"/>
    <rect x="22" y="46" width="3" height="10" fill="#5D4037"/>
    <polygon points="23.5,30 17,46 30,46" fill="#2E7D32"/>
    <circle cx="62" cy="14" r="12" fill="#4CAF50"/>
    <path d="M55,14 L59,18 L69,8" stroke="white" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`,

  desl_escorr_esperado: `<svg viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg">
    <rect width="80" height="80" fill="#FFF8E1" rx="8"/>
    <path d="M0,78 Q25,42 50,52 Q75,62 80,48 L80,80 L0,80 Z" fill="#6D4C41"/>
    <path d="M0,75 Q25,38 50,48 Q75,58 80,44" stroke="#F59E0B" stroke-width="2.5" fill="none" stroke-dasharray="5,3" stroke-linecap="round"/>
    <path d="M32,62 L38,50 L30,44" stroke="#F59E0B" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M50,55 L56,46" stroke="#F59E0B" stroke-width="2" fill="none" stroke-linecap="round"/>
    <polygon points="62,4 74,24 50,24" fill="#F59E0B"/>
    <text x="62" y="21" font-size="13" fill="white" font-weight="bold" text-anchor="middle">!</text>
  </svg>`,

  desl_escorr_ocorrido: `<svg viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg">
    <rect width="80" height="80" fill="#FFEBEE" rx="8"/>
    <path d="M0,78 Q25,42 50,52 Q75,62 80,48 L80,80 L0,80 Z" fill="#6D4C41"/>
    <path d="M32,46 Q48,62 52,73 Q40,67 26,74 Q16,69 32,46 Z" fill="#8D6E63" opacity="0.85"/>
    <path d="M18,56 Q32,64 36,74 Q26,72 16,73 Z" fill="#795548" opacity="0.75"/>
    <circle cx="62" cy="14" r="12" fill="#EF4444"/>
    <path d="M55,8 L69,20 M69,8 L55,20" stroke="white" stroke-width="3" stroke-linecap="round"/>
  </svg>`,

  /* ── Q10: Processos de instabilização ─────────────────────────────── */
  desl_instab_sem_risco: `<svg viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg">
    <rect width="80" height="80" fill="#E8F5E9" rx="8"/>
    <path d="M0,78 L38,28 L80,48 L80,80 L0,80 Z" fill="#4CAF50" opacity="0.35"/>
    <path d="M0,76 L38,26 L80,46" stroke="#2E7D32" stroke-width="2.5" fill="none" stroke-linecap="round"/>
    <rect x="34" y="44" width="3" height="10" fill="#5D4037"/>
    <polygon points="35.5,28 29,44 42,44" fill="#1B5E20"/>
    <circle cx="62" cy="14" r="12" fill="#4CAF50"/>
    <path d="M55,14 L59,18 L69,8" stroke="white" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`,

  desl_instab_esperado: `<svg viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg">
    <rect width="80" height="80" fill="#FFF8E1" rx="8"/>
    <path d="M0,78 L38,32 L80,52 L80,80 L0,80 Z" fill="#F59E0B" opacity="0.25"/>
    <path d="M0,76 L38,30 L80,50" stroke="#F59E0B" stroke-width="2.5" fill="none" stroke-dasharray="5,3" stroke-linecap="round"/>
    <path d="M36,46 L42,34 L34,26" stroke="#F59E0B" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M54,54 L60,44" stroke="#F59E0B" stroke-width="2" fill="none" stroke-linecap="round"/>
    <polygon points="62,4 74,24 50,24" fill="#F59E0B"/>
    <text x="62" y="21" font-size="13" fill="white" font-weight="bold" text-anchor="middle">!</text>
  </svg>`,

  desl_instab_ocorrido: `<svg viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg">
    <rect width="80" height="80" fill="#FFEBEE" rx="8"/>
    <path d="M0,80 L0,58 L18,38 L48,32 L80,46 L80,80 Z" fill="#6D4C41"/>
    <path d="M14,54 Q34,70 54,64 Q58,78 28,80 Z" fill="#8D6E63" opacity="0.9"/>
    <path d="M4,66 L18,40 L48,34" stroke="#B71C1C" stroke-width="2" fill="none" stroke-dasharray="4,2" stroke-linecap="round"/>
    <circle cx="62" cy="14" r="12" fill="#EF4444"/>
    <path d="M55,8 L69,20 M69,8 L55,20" stroke="white" stroke-width="3" stroke-linecap="round"/>
  </svg>`,
};
