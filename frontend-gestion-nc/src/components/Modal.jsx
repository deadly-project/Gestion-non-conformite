import { useEffect } from "react";

export default function Modal({ titre, onFermer, children, pied, largeur = "large" }) {
    useEffect(() => {
        function surTouche(event) {
            if (event.key === "Escape") {
                onFermer?.();
            }
        }
        document.addEventListener("keydown", surTouche);

        const ancienDefilement = document.body.style.overflow;
        document.body.style.overflow = "hidden";

        return () => {
            document.removeEventListener("keydown", surTouche);
            document.body.style.overflow = ancienDefilement;
        };
    }, [onFermer]);

    return (
        <div className="nc-overlay" role="presentation">
            <div
                className={`nc-modal nc-modal-${largeur}`}
                role="dialog"
                aria-modal="true"
                aria-labelledby="nc-modal-titre"
            >
                <header>
                    <h2 id="nc-modal-titre">{titre}</h2>
                    <button type="button" aria-label="Fermer" onClick={onFermer}>×</button>
                </header>
                <div className="nc-modal-corps">{children}</div>
                {pied && <footer>{pied}</footer>}
            </div>
        </div>
    );
}