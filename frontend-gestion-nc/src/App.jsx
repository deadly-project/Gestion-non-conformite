import { useEffect, useState } from "react";
import {
    BrowserRouter,
    Routes,
    Route,
    Navigate,
    Outlet,
    useLocation,
    useNavigate,
} from "react-router-dom";

import Login from "./components/Login";
import Nav from "./components/Nav";
import ProtectedRoute from "./components/ProtectedRoute";
import CreationUtilisateur from "./components/CreationUtilisateur";
import { apiRequest } from "./api/api";
import './App.css'

function Page({ titre }) {
    return (
        <main>
            <h1>{titre}</h1>
            <p>Cette fonctionnalité sera développée dans la prochaine étape.</p>
        </main>
    );
}

function Layout({ utilisateur, onLogout }) {
    return (
        <>
            <Nav utilisateur={utilisateur} onLogout={onLogout} />
            <hr />
            <Outlet />
        </>
    );
}

function LoginPage({ onLogin }) {
    const navigate = useNavigate();
    const location = useLocation();

    async function connecter(user) {
        onLogin(user);

        const destination = location.state?.from?.pathname;
        const routesParRole = {
            ADMINISTRATEUR: "/admin/dashboard",
            DECLARANT: "/declarant/non-conformites",
            AUDITEUR: "/auditeur/audits",
            RESPONSABLE_QUALITE: "/responsable/non-conformites",
        };

        navigate(destination || routesParRole[user.role] || "/", {
            replace: true,
        });
    }

    return <Login onLogin={connecter} />;
}


function Application() {
    const [utilisateur, setUtilisateur] = useState(null);
    const [verification, setVerification] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        let actif = true;

        async function verifierSession() {
            try {
                const user = await apiRequest("/api/auth/me");

                if (actif) {
                    setUtilisateur(user);
                }
            } catch (error) {
                if (actif) {
                    setUtilisateur(null);
                }
            } finally {
                if (actif) {
                    setVerification(false);
                }
            }
        }

        verifierSession();

        return () => {
            actif = false;
        };
    }, []);

    async function deconnexion() {
        try {
            await apiRequest("/api/auth/logout", {
                method: "POST",
            });
        } catch (error) {
            console.error("Erreur lors de la déconnexion :", error);
        } finally {
            setUtilisateur(null);
            navigate("/login", { replace: true });
        }
    }

    if (verification) {
        return <p>Vérification de la session...</p>;
    }

    return (
        <Routes>
            <Route
                path="/login"
                element={
                    utilisateur
                        ? <Navigate to="/" replace />
                        : <LoginPage onLogin={setUtilisateur} />
                }
            />

            <Route
                path="/unauthorized"
                element={
                    <main>
                        <h1>Accès refusé</h1>
                        <p>Ton rôle ne permet pas d'accéder à cette page.</p>
                    </main>
                }
            />

            <Route
                element={<ProtectedRoute utilisateur={utilisateur} />}
            >
                <Route
                    element={
                        <Layout
                            utilisateur={utilisateur}
                            onLogout={deconnexion}
                        />
                    }
                >
                    <Route
                        path="/"
                        element={<RoleAccueil utilisateur={utilisateur} />}
                    />

                    <Route
                        element={
                            <ProtectedRoute
                                utilisateur={utilisateur}
                                rolesAutorises={["ADMINISTRATEUR"]}
                            />
                        }
                    >
                        <Route
                            path="/admin/dashboard"
                            element={<Page titre="Administration du SMQ" />}
                        />
                        <Route
                            path="/admin/utilisateurs"
                            element={<CreationUtilisateur onCreated={() => {}} />}
                        />
                    </Route>

                    <Route
                        element={
                            <ProtectedRoute
                                utilisateur={utilisateur}
                                rolesAutorises={["DECLARANT"]}
                            />
                        }
                    >
                        <Route
                            path="/declarant/non-conformites"
                            element={<Page titre="Mes non-conformités" />}
                        />
                        <Route
                            path="/declarant/non-conformites/nouvelle"
                            element={<Page titre="Déclarer une non-conformité" />}
                        />
                    </Route>

                    <Route
                        element={
                            <ProtectedRoute
                                utilisateur={utilisateur}
                                rolesAutorises={["AUDITEUR"]}
                            />
                        }
                    >
                        <Route
                            path="/auditeur/audits"
                            element={<Page titre="Mes audits" />}
                        />
                        <Route
                            path="/auditeur/constats"
                            element={<Page titre="Constats d'audit" />}
                        />
                    </Route>

                    <Route
                        element={
                            <ProtectedRoute
                                utilisateur={utilisateur}
                                rolesAutorises={["RESPONSABLE_QUALITE"]}
                            />
                        }
                    >
                        <Route
                            path="/responsable/non-conformites"
                            element={<Page titre="Suivi des non-conformités" />}
                        />
                        <Route
                            path="/responsable/capa"
                            element={<Page titre="Actions correctives et préventives" />}
                        />
                        <Route
                            path="/responsable/audits"
                            element={<Page titre="Planification des audits" />}
                        />
                    </Route>
                </Route>
            </Route>

            <Route
                path="*"
                element={<Navigate to={utilisateur ? "/" : "/login"} replace />}
            />
        </Routes>
    );
}


function RoleAccueil({ utilisateur }) {
    const destinations = {
        ADMINISTRATEUR: "/admin/dashboard",
        DECLARANT: "/declarant/non-conformites",
        AUDITEUR: "/auditeur/audits",
        RESPONSABLE_QUALITE: "/responsable/non-conformites",
    };

    return (
        <Navigate
            to={destinations[utilisateur?.role] || "/unauthorized"}
            replace
        />
    );
}

function App() {

  return (
    <BrowserRouter>
      <Application />
    </BrowserRouter>
  )
}

export default App
