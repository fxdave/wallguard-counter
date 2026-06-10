.PHONY: install start import-prod-db

install:
	podman compose build

start:
	podman compose up

import-prod-db:
	node scripts/import-prod-db.mjs
