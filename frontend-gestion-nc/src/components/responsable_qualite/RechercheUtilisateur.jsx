import { useEffect, useState } from "react";
import { apiRequest } from "../../api/api";

/**
 * Champ de recherche d'utilisateur par nom, prénom ou matricule.
 * Affiche « Nom Prénom — matricule » et permet d'en choisir un.
 *
 * @param role   filtre facultatif (ex. "AUDITEUR")
 * @param valeur utilisateur choisi ({ id, nom, prenom, matricule }) ou null
 */
export default function RechercheUtilisateur({
    id, label, role = "", valeur, onChange, requis = false, aide,
}) {
    const [saisie, setSaisie] = useState("");
    const [resultats, setResultats] = useState([]);
    const [ouvert, setOuvert] = useState(false);
    const [chargement, setChargement] = useState(false);
    const [erreur, setErreur] = useState("");

    useEffect(() => {
        if (!ouvert) return undefined;

        let actif = true;
        const minuteur = setTimeout(async () => {
            setChargement(true);
            try {
                const donnees = await apiRequest(
                    `/api/non-conformites/recherche-utilisateurs?q=${encodeURIComponent(saisie)}&role=${encodeURIComponent(role)}`
                );
                if (actif) {
                    setResultats(donnees);
                    setErreur("");
                }
            } catch (error) {
                if (actif) setErreur(error.message || "Recherche impossible.");
            } finally {
                if (actif) setChargement(false);
            }
        }, 250);

        return () => {
            actif = false;
            clearTimeout(minuteur);
        };
    }, [saisie, role, ouvert]);

    function choisir(utilisateur) {
        onChange(utilisateur);
        setSaisie("");
        setOuvert(false);
    }

    return (
        <div className="nc-champ nc-recherche">
            <label htmlFor={id}>{label}{requis ? " *" : ""}</label>

            {valeur ? (
                <div className="nc-choisi">
                    <strong>{valeur.nom} {valeur.prenom}</strong>
                    <span>— matricule {valeur.matricule}</span>
                    <button type="button" className="nc-btn nc-btn-secondaire nc-btn-petit"
                        onClick={() => onChange(null)}>
                        Changer
                    </button>
                </div>
            ) : (
                <>
                    <input
                        id={id}
                        type="search"
                        value={saisie}
                        placeholder="Nom, prénom ou matricule..."
                        autoComplete="off"
                        onChange={(e) => { setSaisie(e.target.value); setOuvert(true); }}
                        onFocus={() => setOuvert(true)}
                        onBlur={() => setTimeout(() => setOuvert(false), 150)}
                    />
                    {ouvert && (
                        <ul className="nc-recherche-liste" role="listbox">
                            {chargement && <li><span className="nc-aide">&nbsp;Recherche...</span></li>}
                            {erreur && <li><span className="nc-erreur">{erreur}</span></li>}
                            {!chargement && !erreur && resultats.length === 0 && (
                                <li><span className="nc-aide">&nbsp;Aucun résultat</span></li>
                            )}
                            {resultats.map((u) => (
                                <li key={u.id} role="option" aria-selected="false">
                                    <button type="button"
                                        onMouseDown={(e) => e.preventDefault()}
                                        onClick={() => choisir(u)}>
                                        <strong>{u.nom} {u.prenom}</strong> — matricule {u.matricule}
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </>
            )}
            {aide && <span className="nc-aide">{aide}</span>}
        </div>
    );
}