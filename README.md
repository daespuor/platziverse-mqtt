#platziverse-mqtt



## 'agent/connected'

``` js
{
    agent:{
        uuid, //autogenerado
        username, //define por configuración
        name, //define por configuración
        hostname, //se obtiene del sistema operativo
        pid // se obtiene del proceso
    }
}
``` 

## 'agent/disconnected'

``` js
{
    agent:{
        uuid
    }
}
```

## 'agent/message'

``` js
{
    agent,
    metrics:[{
        type:{
            value,
            description   
        },
        value
    }],
    timestamp //cuando se crea el mensaje
}
```