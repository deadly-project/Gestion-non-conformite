
Dans backend-gestion-nc/db/  
créer la base de donnée et créer la table et les vues  
``
psql -U postgres -d smq_db
psql -U postgres -d smq_db \
  -v ON_ERROR_STOP=1 \
  -f smq_schema_v3_sans_triggers.sql
``
puis genere la clé du jwt avec ceci pour linux
``
openssl rand -base64 32
``
puis dans backend-gestion-nc/
créer le fichier .env  
ajouter ces information dedans  
```
DB_PASSWORD=MOT_DE_PASSE
APP_JWT_SECRET=La_cle_genere_pour_la_jwt
APP_JWT_EXPIRATION_MS=3600000

APP_FRONTEND_URLS=http://localhost:5173
ADMIN_EMAIL=admin@gmail.com
ADMIN_PASSWORD=admin
ADMIN_MATRICULE=ADMIN-001
ADMIN_NOM=Administrateur
ADMIN_PRENOM=prenon_admn
```
