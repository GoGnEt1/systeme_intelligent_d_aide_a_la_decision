import psycopg2
from decouple import config

print("=== Test de connexion PostgreSQL ===")
print(f"Host: {config('DB_HOST')}")
print(f"Database: {config('DB_NAME')}")
print(f"User: {config('DB_USER')}")
print(f"Port: {config('DB_PORT')}")

try:
    conn = psycopg2.connect(
        dbname=config('DB_NAME'),
        user=config('DB_USER'),
        password=config('DB_PSWD'),
        host=config('DB_HOST'),
        port='5432',
        connect_timeout=5
    )
    print("\n✓ Connexion PostgreSQL réussie!")
    
    # Tester une requête
    cursor = conn.cursor()
    cursor.execute("SELECT version();")
    version = cursor.fetchone()
    print(f"✓ Version PostgreSQL: {version[0]}")
    
    cursor.close()
    conn.close()
    
except psycopg2.OperationalError as e:
    print(f"\n✗ Erreur de connexion PostgreSQL:")
    print(f"   {e}")
    print("\nVérifications à faire:")
    print("1. PostgreSQL est-il installé? (Get-Service postgresql*)")
    print("2. Le service tourne-t-il? (netstat -ano | findstr :5432)")
    print("3. Le mot de passe dans .env est-il correct?")
    print("4. La base de données existe-t-elle? (psql -U postgres -c '\\l')")
    
except Exception as e:
    print(f"\n✗ Erreur inattendue: {e}")