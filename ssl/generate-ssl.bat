@echo off
REM Gera certificado autoassinado para HTTPS local
setlocal
set CERT_NAME=server
set DAYS=365

REM Gera chave privada
openssl genrsa -out %CERT_NAME%.key 2048
REM Gera certificado autoassinado
openssl req -new -x509 -key %CERT_NAME%.key -out %CERT_NAME%.crt -days %DAYS% -subj "/CN=localhost"

REM Move para pasta ssl
move %CERT_NAME%.key ssl\
move %CERT_NAME%.crt ssl\

echo Certificado gerado em ssl\server.key e ssl\server.crt
pause
