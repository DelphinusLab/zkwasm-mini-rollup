build:
	wasm-pack build --release --out-name application --out-dir pkg
	wasm-opt -Oz -o ../ts/src/application/application_bg.wasm pkg/application_bg.wasm
	cp pkg/application_bg.wasm ../ts/src/application/application_bg.wasm
	cp pkg/application.d.ts ../ts/src/application/application.d.ts
	cp pkg/application_bg.js ../ts/src/application/application_bg.js
	cp pkg/application_bg.wasm.d.ts ../ts/src/application/application_bg.wasm.d.ts

clean:
	rm -rf pkg
	rm -rf ../ts/src/application/application_bg.wasm
	rm -rf ../ts/src/application/application.d.ts
	rm -rf ../ts/src/application/application_bg.js
	rm -rf ../ts/src/application/application_bg.wasm.d.ts
