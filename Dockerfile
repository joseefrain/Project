FROM mongo:6.0

# Inicia MongoDB con soporte para replica set
CMD ["mongod", "--replSet", "rs0"]