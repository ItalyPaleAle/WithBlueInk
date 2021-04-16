.PHONY: all clean dist serve

all: serve

clean:
	rm -rf public

dist:
	sh dist.sh

serve:
	sh serve.sh
