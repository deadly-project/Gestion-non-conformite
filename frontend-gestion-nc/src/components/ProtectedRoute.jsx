
import { Navigate, Outlet, useLocation } from "react-router-dom";

export default function ProtectedRoute({
    utilisateur,
    rolesAutorises,
}) {
    const location = useLocation();

    if (!utilisateur) {
        return (
            <Navigate
                to="/login"
                replace
                state={{ from: location }}
            />
        );
    }

    if (
        rolesAutorises &&
        !rolesAutorises.includes(utilisateur.role)
    ) {
        return <Navigate to="/unauthorized" replace />;
    }

    return <Outlet />;
}
