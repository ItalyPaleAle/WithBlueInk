all: serve

deps:
	bundle install

updatedeps: deps
	bundle update

clean:
	jekyll clean

dist:
	@echo "\033[0;1mBuilding for environment: \033[0;1;32mproduction\033[0;0m"
	@echo "\033[0;1mCleaning destination directory...\033[0;0m"
	jekyll clean
	@echo "\033[0;1mBuilding...\033[0;0m"
	JEKYLL_ENV=production jekyll build

serve:
	@echo "\033[0;1mBuilding for environment: \033[0;1;35mdevelopment\033[0;0m"
	@echo "\033[0;1mBuilding and starting web server...\033[0;0m"
	JEKYLL_ENV=development jekyll serve --host=0.0.0.0
