FROM debian:bookworm-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends freeradius freeradius-rest freeradius-utils ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY conf/mods-available/rest /etc/freeradius/3.0/mods-available/rest
COPY conf/sites-available/poafi /etc/freeradius/3.0/sites-available/poafi
COPY conf/sites-available/dynamic-clients /etc/freeradius/3.0/sites-available/dynamic-clients
COPY conf/clients.conf /etc/freeradius/3.0/clients.conf

RUN rm -f /etc/freeradius/3.0/mods-enabled/rest \
    && ln -s ../mods-available/rest /etc/freeradius/3.0/mods-enabled/rest \
    && rm -f /etc/freeradius/3.0/sites-enabled/default \
       /etc/freeradius/3.0/sites-enabled/inner-tunnel \
       /etc/freeradius/3.0/sites-enabled/poafi \
       /etc/freeradius/3.0/sites-enabled/dynamic-clients \
    && ln -s ../sites-available/poafi /etc/freeradius/3.0/sites-enabled/default \
    && ln -s ../sites-available/dynamic-clients /etc/freeradius/3.0/sites-enabled/dynamic-clients \
    && chown -R freerad:freerad /etc/freeradius/3.0

EXPOSE 1812/udp 1813/udp

USER freerad
ENTRYPOINT ["freeradius", "-f", "-l", "stdout"]
