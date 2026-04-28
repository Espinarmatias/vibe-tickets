/* =====================================================
 * VIBE SCANNER — js/scanner.js
 * Pfizer Corporate 2026
 * ===================================================== */

(function () {
  'use strict';

  // ============ CONFIG ============
  const SUPABASE_URL = 'https://smeuthybgzqxohjifgix.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_T5f432DOcZl3eXk4nQpBpg_NQz0TAl3';

  const RESULT_DISPLAY_MS = 2200;       // tiempo que el banner queda visible
  const SCAN_COOLDOWN_MS = 800;          // tiempo mínimo entre scans
  const QR_BOX_SIZE = 280;
  const QR_FPS = 10;

  // ============ STATE ============
  const state = {
    supabase: null,
    staffToken: null,
    staff: null,
    event: null,
    scanner: null,
    isProcessing: false,
    lastScanTime
