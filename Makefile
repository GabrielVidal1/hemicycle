up:
	yarn dev:packages

up.docs:
	yarn dev:docs

build:
	yarn build-packages

delete-node_modules:
	find . -name "node_modules" -type d -prune -exec rm -rf '{}' +

install:
	yarn

test:
	yarn test

lint:
	yarn lint

