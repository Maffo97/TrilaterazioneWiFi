FROM ubuntu:20.04

RUN apt update && \
    apt upgrade -y && \
    apt install -y python3-pip && \
    apt install -y git

WORKDIR /app

RUN git clone https://github.com/Maffo97/TrilaterazioneWiFi.git

RUN pip3 install -r requirements.txt

WORKDIR /app/TrilaterazioneWiFi

EXPOSE 5000

ENTRYPOINT [ "python3" ]

CMD ["start.py"]

