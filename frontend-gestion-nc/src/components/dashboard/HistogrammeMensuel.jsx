import { MOIS_COURTS, MOIS_LONGS } from "./mois";
import "./DashboardPage.css";

const L = 720;          // largeur du dessin (le SVG s'adapte à l'écran grâce au viewBox)
const H = 300;
const MARGE = { haut: 20, droite: 12, bas: 32, gauche: 38 };

/** Plafond « rond » de l'axe vertical : 4, 5, 10, 20, 50... */
function plafond(max) {
    if (max <= 4) return 4;
    const pas = Math.pow(10, Math.floor(Math.log10(max)));
    return Math.ceil(max / pas) * pas;
}

/**
 * Histogramme groupé : pour chaque mois, NC déclarées et NC prises en charge (ouvertes).
 * @param donnees [{ mois: 1..12, declarees, prisesEnCharge }]
 */
export default function HistogrammeMensuel({ donnees }) {
    const max = plafond(Math.max(0, ...donnees.flatMap((d) => [d.declarees, d.prisesEnCharge])));
    const largeurZone = L - MARGE.gauche - MARGE.droite;
    const hauteurZone = H - MARGE.haut - MARGE.bas;
    const largeurMois = largeurZone / 12;
    const largeurBarre = Math.min(18, (largeurMois - 8) / 2);
    const y = (valeur) => MARGE.haut + hauteurZone - (valeur / max) * hauteurZone;
    const graduations = [0, 1, 2, 3, 4].map((i) => Math.round((max / 4) * i * 10) / 10);

    const pic = (cle) => {
        const sommet = Math.max(...donnees.map((d) => d[cle]));
        return sommet > 0 ? donnees.filter((d) => d[cle] === sommet).map((d) => d.mois) : [];
    };
    const picDeclarees = pic("declarees");
    const picPrises = pic("prisesEnCharge");

    return (
        <svg
            className="dash-histo"
            viewBox={`0 0 ${L} ${H}`}
            role="img"
            aria-label="Histogramme mensuel des non-conformités déclarées et prises en charge"
        >
            {graduations.map((valeur) => (
                <g key={valeur}>
                    <line
                        x1={MARGE.gauche} x2={L - MARGE.droite} y1={y(valeur)} y2={y(valeur)}
                        className="dash-histo-grille"
                    />
                    <text x={MARGE.gauche - 8} y={y(valeur) + 4} textAnchor="end" className="dash-histo-axe">
                        {valeur}
                    </text>
                </g>
            ))}

            {donnees.map((d, i) => {
                const centre = MARGE.gauche + i * largeurMois + largeurMois / 2;
                const barres = [
                    { cle: "declarees", valeur: d.declarees, x: centre - largeurBarre - 1, classe: "declarees",
                      libelle: "déclarée(s)", pic: picDeclarees.includes(d.mois) },
                    { cle: "prisesEnCharge", valeur: d.prisesEnCharge, x: centre + 1, classe: "prises",
                      libelle: "prise(s) en charge", pic: picPrises.includes(d.mois) },
                ];
                return (
                    <g key={d.mois}>
                        {barres.map((b) => (
                            <g key={b.cle}>
                                <rect
                                    x={b.x}
                                    y={y(b.valeur)}
                                    width={largeurBarre}
                                    height={Math.max(0, MARGE.haut + hauteurZone - y(b.valeur))}
                                    rx="3"
                                    className={`dash-histo-barre ${b.classe} ${b.pic ? "pic" : ""}`}
                                >
                                    <title>{`${MOIS_LONGS[i]} : ${b.valeur} NC ${b.libelle}`}</title>
                                </rect>
                                {b.valeur > 0 && (
                                    <text
                                        x={b.x + largeurBarre / 2} y={y(b.valeur) - 4}
                                        textAnchor="middle" className="dash-histo-valeur"
                                    >
                                        {b.valeur}
                                    </text>
                                )}
                            </g>
                        ))}
                        <text x={centre} y={H - 10} textAnchor="middle" className="dash-histo-axe">
                            {MOIS_COURTS[i]}
                        </text>
                    </g>
                );
            })}
        </svg>
    );
}