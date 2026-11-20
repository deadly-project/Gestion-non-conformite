import DocumentsExplorateur from "./DocumentsExplorateur";
import "../Declarant/nc.css";
import "./documents.css";

/** Bibliothèque documentaire en lecture seule pour les rôles non gestionnaires. */
export default function BibliothequeDocumentsPage() {
    return (
        <main className="nc-page">
            <div className="doc-entete">
                <div>
                    <h1>Bibliothèque documentaire qualité</h1>
                    <p className="nc-aide">
                        Consultez les documents qualité actuellement applicables à votre activité.
                    </p>
                </div>
            </div>
            <DocumentsExplorateur mode="bibliotheque-commune" />
        </main>
    );
}