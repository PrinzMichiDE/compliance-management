import React from 'react';
import { Risk, RiskProbability, RiskImpact } from '@/types/risk';

interface RiskMatrixProps {
  risks: Risk[];
  onRiskClick?: (risk: Risk) => void;
}

const probabilityLevels: RiskProbability[] = [
  RiskProbability.LOW,
  RiskProbability.MEDIUM,
  RiskProbability.HIGH,
];
const impactLevels: RiskImpact[] = [
  RiskImpact.LOW,
  RiskImpact.MEDIUM,
  RiskImpact.HIGH,
];

function getCellColor(prob: RiskProbability, impact: RiskImpact) {
  // Einfache Farb-Logik: grün (niedrig), gelb (mittel), rot (hoch)
  if (prob === RiskProbability.HIGH && impact === RiskImpact.HIGH) return 'bg-red-500';
  if (
    (prob === RiskProbability.HIGH && impact === RiskImpact.MEDIUM) ||
    (prob === RiskProbability.MEDIUM && impact === RiskImpact.HIGH)
  ) return 'bg-orange-400';
  if (
    (prob === RiskProbability.MEDIUM && impact === RiskImpact.MEDIUM) ||
    (prob === RiskProbability.HIGH && impact === RiskImpact.LOW) ||
    (prob === RiskProbability.LOW && impact === RiskImpact.HIGH)
  ) return 'bg-yellow-300';
  return 'bg-green-300';
}

export const RiskMatrix: React.FC<RiskMatrixProps> = ({ risks, onRiskClick }) => {
  // Matrix als 2D-Array: [impact][probability]
  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">Risikomatrix</h2>
      <div className="overflow-x-auto">
        <table className="border-collapse">
          <thead>
            <tr>
              <th className="p-2"></th>
              {probabilityLevels.map((prob) => (
                <th key={prob} className="p-2 text-center font-medium text-slate-700">
                  {prob}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {impactLevels.slice().reverse().map((impact) => (
              <tr key={impact}>
                <th className="p-2 text-right font-medium text-slate-700">{impact}</th>
                {probabilityLevels.map((prob) => {
                  const cellRisks = risks.filter(
                    (r) => r.probability === prob && r.impact === impact
                  );
                  return (
                    <td
                      key={prob + '-' + impact}
                      className={`w-32 h-24 align-top border border-slate-300 ${getCellColor(prob, impact)}`}
                    >
                      <div className="flex flex-wrap gap-1 justify-center items-start h-full">
                        {cellRisks.length === 0 && <span className="text-xs text-slate-400">-</span>}
                        {cellRisks.map((risk) => (
                          <button
                            key={risk.riskId}
                            title={risk.title}
                            onClick={() => onRiskClick?.(risk)}
                            className="rounded-full bg-white border border-slate-400 px-2 py-1 text-xs font-semibold shadow hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          >
                            {risk.title.length > 12 ? risk.title.slice(0, 12) + '…' : risk.title}
                          </button>
                        ))}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-2 text-xs text-slate-500">Achsen: Horizontal = Wahrscheinlichkeit, Vertikal = Auswirkung</div>
    </div>
  );
};

export default RiskMatrix; 