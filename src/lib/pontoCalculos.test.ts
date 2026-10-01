import assert from "node:assert/strict";
import {
  calculateFinancialValues,
  calculateOvertimeBreakdown,
  calculateWorkedMinutes,
  isPJContract,
  resolvePJDailyBaseMinutes,
  summarizePointDay,
} from "./pontoCalculos";

const dia03 = {
  hora_entrada_1: "04:05",
  hora_saida_1: "07:53",
};

const dia04 = {
  hora_entrada_1: "08:12",
  hora_saida_1: "12:05",
  hora_entrada_2: "14:34",
  hora_saida_2: "21:43",
};

assert.equal(calculateWorkedMinutes(dia03), 228, "Dia 03 deve totalizar 3h48");
assert.equal(calculateWorkedMinutes(dia04), 662, "Dia 04 deve totalizar 11h02");

const overtimeDia04 = calculateOvertimeBreakdown(dia04, 480, false, false);
assert.deepEqual(
  overtimeDia04,
  { extra50: 182, extraNoturno: 0, extra100: 0 },
  "A hora extra deve ser somente o excedente de 8h: 3h02",
);

const resumoDia03 = summarizePointDay({
  entry: dia03,
  expectedMinutes: null,
  isSunday: false,
  isHoliday: false,
  shouldCountAbsence: true,
});
const resumoDia04 = summarizePointDay({
  entry: dia04,
  expectedMinutes: null,
  isSunday: false,
  isHoliday: false,
  shouldCountAbsence: true,
});

const financeiroGabriel = calculateFinancialValues({
  contractType: "diarista",
  contractValue: 150,
  days: [resumoDia03, resumoDia04],
});

assert.equal(financeiroGabriel.salarioBase, 221.25);
assert.equal(Number(financeiroGabriel.valorExtra50.toFixed(4)), 85.3125);
assert.equal(Number(financeiroGabriel.totalBruto.toFixed(2)), 306.56);

const financeiroHoristaAutomatico = calculateFinancialValues({
  contractType: "horista",
  contractValue: 25,
  days: [resumoDia04],
  overtimeGeneratesValue: true,
});
assert.ok(resumoDia04.extra50 > 0, "A hora extra do horista deve continuar visível");
assert.equal(financeiroHoristaAutomatico.valorExtra50, 0, "Horista não recebe adicional financeiro de hora extra");

const financeiroCltParcial = calculateFinancialValues({
  contractType: "clt",
  contractValue: 3000,
  days: [resumoDia04],
  expectedMonthMinutes: 200 * 60,
  basePaymentRatio: 0.25,
});
assert.equal(financeiroCltParcial.salarioBase, 750, "Seleção parcial do CLT deve ratear a base mensal");

const semJornadaSemRegistro = summarizePointDay({
  entry: null,
  expectedMinutes: null,
  isSunday: false,
  isHoliday: false,
  shouldCountAbsence: true,
});
assert.equal(
  semJornadaSemRegistro.missingMinutes,
  0,
  "Sem jornada definida não pode haver falta automática",
);

const registroIncompleto = summarizePointDay({
  entry: { hora_entrada_1: "06:00" },
  expectedMinutes: 480,
  isSunday: false,
  isHoliday: false,
  shouldCountAbsence: true,
});
assert.equal(registroIncompleto.incomplete, true);
assert.equal(registroIncompleto.workedMinutes, 0);
assert.equal(registroIncompleto.missingMinutes, 0);

assert.equal(
  resolvePJDailyBaseMinutes({ configuredDayMinutes: 540, weeklyHours: 40 }),
  480,
  "PJ com carga semanal de 40h deve limitar a base diária a 8h",
);
assert.equal(
  resolvePJDailyBaseMinutes({ configuredDayMinutes: 240, weeklyHours: 40 }),
  240,
  "PJ com dia curto configurado não deve ser aumentado para 8h",
);
assert.equal(
  resolvePJDailyBaseMinutes({ configuredDayMinutes: 540, weeklyHours: 44 }),
  480,
  "PJ não deve usar base diária acima de 8h mesmo se a carga semanal estiver maior",
);
assert.equal(isPJContract("P.J."), true, "Cadastro com PJ pontuado deve seguir a regra de PJ");

const resumoPjJornada40h = summarizePointDay({
  entry: { hora_entrada_1: "08:00", hora_saida_1: "12:00", hora_entrada_2: "13:00", hora_saida_2: "18:00" },
  expectedMinutes: resolvePJDailyBaseMinutes({ configuredDayMinutes: 540, weeklyHours: 40 }),
  isSunday: false,
  isHoliday: false,
  shouldCountAbsence: false,
  specialDayAllHoursAt100: false,
});
assert.equal(resumoPjJornada40h.regularMinutes, 480, "PJ 40h deve ter 8h normais no dia");
assert.equal(resumoPjJornada40h.extra50, 60, "A hora depois da base de 8h deve ficar disponível para Extra PJ");

const financeiroPjPorDiaria = calculateFinancialValues({
  contractType: "pj",
  contractValue: 240,
  days: [resumoDia03, resumoDia04, registroIncompleto],
  expectedMonthMinutes: 220 * 60,
});
assert.equal(financeiroPjPorDiaria.diasTrabalhados, 2);
assert.equal(financeiroPjPorDiaria.salarioBase, 480, "PJ deve receber dias completos multiplicados pela diária");
assert.equal(financeiroPjPorDiaria.descontoFalta, 0, "PJ não pode ter desconto por ausência");
assert.equal(financeiroPjPorDiaria.valorExtra50, 0, "PJ não pode calcular extra 50%");
assert.equal(financeiroPjPorDiaria.valorExtra100, 0, "PJ não pode calcular extra 100%");
assert.equal(Number(financeiroPjPorDiaria.valorExtraPJ.toFixed(2)), 91, "PJ deve agrupar o excedente em Extra PJ sem adicional");
assert.equal(Number(financeiroPjPorDiaria.totalBruto.toFixed(2)), 571);

const resumoDomingoPj = {
  ...summarizePointDay({
    entry: { hora_entrada_1: "08:00", hora_saida_1: "18:00" },
    expectedMinutes: 480,
    isSunday: true,
    isHoliday: false,
    shouldCountAbsence: false,
    specialDayAllHoursAt100: false,
  }),
  isSunday: true,
  isHoliday: false,
};
const financeiroPjComDomingo = calculateFinancialValues({
  contractType: "pj",
  contractValue: 100,
  days: [resumoDomingoPj],
});
assert.equal(financeiroPjComDomingo.salarioBase, 100, "Domingo trabalhado deve gerar a diária normal do PJ");
assert.equal(financeiroPjComDomingo.valorExtra100, 0, "PJ não pode calcular extra 100% no domingo");
assert.equal(financeiroPjComDomingo.valorExtraPJ, 25, "As duas horas excedentes do domingo entram somente como Extra PJ");

const resumoSabadoPj = summarizePointDay({
  entry: { hora_entrada_1: "08:00", hora_saida_1: "12:00", hora_entrada_2: "13:00", hora_saida_2: "17:30" },
  expectedMinutes: 540,
  isSunday: false,
  isHoliday: false,
  shouldCountAbsence: false,
});
assert.equal(resumoSabadoPj.extra50, 0, "Sábado do PJ abaixo de 9 horas não pode virar integralmente hora adicional");

const diaFuturo = summarizePointDay({
  entry: null,
  expectedMinutes: 480,
  isSunday: false,
  isHoliday: false,
  shouldCountAbsence: false,
});
assert.equal(diaFuturo.missingMinutes, 0, "Dia futuro não pode gerar falta");

console.log("Cálculos do espelho de ponto validados com sucesso.");
