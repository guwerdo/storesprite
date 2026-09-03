# WireMock image with the StoreSprite mock-backend mappings baked in.
#
# The harness runs from inside the stocksprite-dev container against the host
# Docker engine, and bind-mount sources are resolved by the engine in its own
# namespace — so a /workspace/... bind source for the mappings would mount an
# empty directory and WireMock would answer 404 for every request. Baking the
# mappings into the image (the build context is streamed client-side) makes the
# harness location-independent: it works run from the host or from the container.
FROM wiremock/wiremock:latest
COPY mappings/ /home/wiremock/mappings/
