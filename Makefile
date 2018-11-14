all: serve

deps:
	bundle install

updatedeps: deps
	bundle update

clean:
	bundle exec jekyll clean

dist:
	@echo "\033[0;1mBuilding for environment: \033[0;1;32mproduction\033[0;0m"
	@echo "\033[0;1mCleaning destination directory...\033[0;0m"
	bundle exec jekyll clean
	@echo "\033[0;1mBuilding...\033[0;0m"
	JEKYLL_ENV=production bundle exec jekyll build
	# Fix an issue with the sitemap
	sed -i'' -e 's/\/about/\/about.html/g' _site/sitemap.xml

serve:
	@echo "\033[0;1mBuilding for environment: \033[0;1;35mdevelopment\033[0;0m"
	@echo "\033[0;1mBuilding and starting web server...\033[0;0m"
	JEKYLL_ENV=development bundle exec jekyll serve --drafts --host=0.0.0.0
