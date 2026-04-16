FROM debian:bookworm-slim
COPY cave-linux-x64 /usr/local/bin/cave
RUN chmod +x /usr/local/bin/cave
ENTRYPOINT ["cave"]
