# ============================================================
#  TempsFlow — Frontend Dockerfile
#  Serves static HTML/CSS/JS via nginx
# ============================================================

FROM nginx:alpine

# Copy all frontend files into nginx's serve directory
COPY . /usr/share/nginx/html

# Custom nginx config to handle SPA-style routing
RUN echo 'server { \
  listen 80; \
  root /usr/share/nginx/html; \
  index login/login.html; \
  location / { \
    try_files $uri $uri/ /login/login.html; \
  } \
}' > /etc/nginx/conf.d/default.conf

EXPOSE 80