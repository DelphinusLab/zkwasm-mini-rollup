build:
	wasm-pack build --release --out-name bootstrap --out-dir pkg
	wasm-opt -Oz -o ../ts/src/js/bootstrap_bg.wasm pkg/bootstrap_bg.wasm
	cp pkg/bootstrap.d.ts ../ts/src/js/bootstrap.d.ts
	cp pkg/bootstrap_bg.js ../ts/src/js/bootstrap_bg.js
	cp pkg/bootstrap_bg.wasm.d.ts ../ts/src/js/bootstrap_bg.wasm.d.ts

clean:
	rm -rf pkg
	rm -rf ../ts/src/js/bootstrap_bg.wasm
	rm -rf ../ts/src/js/bootstrap.d.ts
	rm -rf ../ts/src/js/bootstrap_bg.js
	rm -rf ../ts/src/js/bootstrap_bg.wasm.d.ts
