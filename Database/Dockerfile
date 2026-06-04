# ============================================================
#  TempsFlow — Database Dockerfile
#  MySQL 8.0 with auto-import of schema
# ============================================================

FROM mysql:8.0

# Set environment variables (overridden by docker-compose)
ENV MYSQL_ROOT_PASSWORD=rootpassword
ENV MYSQL_DATABASE=tempsflow

# Copy SQL schema — MySQL auto-runs all .sql files in this folder on first start
COPY src/init.sql /docker-entrypoint-initdb.d/init.sql

EXPOSE 3306